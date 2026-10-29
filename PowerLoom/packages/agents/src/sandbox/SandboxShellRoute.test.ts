import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { CommandResult, SandboxClient } from "@powerloom/sandbox";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import type { RepoAccess } from "../models/RepoAccess";
import type { RunBuildLog } from "./models/RunBuildLog";
import type { RunShellRouteSlot } from "./models/RunShellRouteSlot";
import { SANDBOX_INTEGRATION, createSandboxTools } from "./sandboxTools";

const context = { vault: "work-projects", agentId: "implementation", runId: 9, owner: "powerloom-run-9", taskId: "AT-1-002", pbiId: 1 };
const info = { id: "box1", owner: "powerloom-run-9", expiresAt: "2026-10-29T12:00:00.000Z", workspace: "/workspace", image: "powerloom-sandbox", toolchains: "" };
const cacheRoot = mkdtempSync(join(tmpdir(), "route-cache-"));
const worktreeRoot = mkdtempSync(join(tmpdir(), "route-worktree-"));
const repos: RepoAccess = { isOn: true, repos: [{ name: "shop", remoteUrl: "", defaultBranch: "main" }], commits: { shop: "0123456789abcdef" }, tools: [] };
const agent = { capabilities: { integrations: { [SANDBOX_INTEGRATION]: true } }, limits: { maxTurns: 40, timeoutMinutes: 60 } } as unknown as AgentDefinition;
const passed: CommandResult = { exitCode: 0, output: "Passed!  - Failed: 0, Passed: 12", truncated: false, timedOut: false, durationMs: 41_000, outputFile: "/workspace/.out/1.log" };

writeFileSync(join(worktreeRoot, "Shop.sln"), "");
mkdirSync(join(cacheRoot, "shop"));
writeFileSync(join(cacheRoot, "shop", "Shop.sln"), "");

// A sandbox service that records each call and answers commands from `results`, in turn.
function fakeClient(calls: string[], results: CommandResult[] = [passed]): Partial<SandboxClient> {
  return {
    open: async () => { calls.push("open"); return { ok: true, value: info }; },
    uploadRepo: async (id, name, tar, message) => { calls.push(`upload ${name} ${message}`); await tar.cancel(); return { ok: true, value: { path: `/workspace/${name}`, files: 4 } }; },
    restore: async (id, repo, target, tar) => { calls.push(`restore ${repo}`); await tar.cancel(); return { ok: true, value: { ok: true, steps: [], skipped: [], packagesPath: "/packages" } }; },
    run: async (id, request) => { calls.push(`run ${request.cwd} ${request.command}`); return { ok: true, value: results.shift() ?? passed }; },
  };
}

function routeWith(client: Partial<SandboxClient>, buildCommands: string[] = []) {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const sandbox = { client: client as SandboxClient, url: "http://sandbox:3300", feeds: [], packageHosts: [], image: "", packageCache: "work-projects", buildCommands };
  const slot: RunShellRouteSlot = { current: null };
  const builds: RunBuildLog = { runs: [], restores: [] };
  const deps = { outside, sandbox, repoCache: { root: cacheRoot }, runWorktree: { current: { repo: "shop", path: worktreeRoot } }, runShellRoute: slot, runBuildLog: builds } as unknown as AgentDeps;
  const tools = createSandboxTools(deps, agent, context, repos);

  return { route: slot.current!, tools, entries, builds };
}

function loggedRuns(builds: RunBuildLog) {
  return builds.runs.map((run) => ({ command: run.command, exitCode: run.exitCode, problem: run.problem }));
}

describe("SandboxShellRoute", () => {
  it("is left by the sandbox tools only for a run with a worktree", () => {
    const slot: RunShellRouteSlot = { current: null };
    const deps = { outside: {}, sandbox: { client: {}, buildCommands: [] }, repoCache: { root: cacheRoot }, runShellRoute: slot } as unknown as AgentDeps;

    createSandboxTools(deps, agent, context, repos);

    assert.equal(slot.current, null);
    assert.ok(routeWith(fakeClient([])).route);
  });

  it("opens the sandbox, restores once, and runs each build on a fresh sync from the shell's folder", async () => {
    const calls: string[] = [];
    const { route, entries } = routeWith(fakeClient(calls));

    const first = await route.run("dotnet build", join(worktreeRoot, "src", "Api"), null);
    const second = await route.run(`dotnet test ${join(worktreeRoot, "Shop.sln")}`, worktreeRoot, 120_000);

    assert.deepEqual(calls, [
      "open",
      "upload shop your worktree",
      "restore shop",
      "run /workspace/shop/src/Api set -o pipefail; dotnet build",
      "upload shop synced from your worktree",
      "run /workspace/shop set -o pipefail; dotnet test /workspace/shop/Shop.sln",
    ]);
    assert.equal(first?.exitCode, 0);
    assert.match(first?.output ?? "", /^\[Ran in the run's sandbox, in \/workspace\/shop\/src\/Api of a fresh copy of the worktree: exit code 0 in 41\.0 s/);
    assert.match(second?.output ?? "", /Passed!  - Failed: 0, Passed: 12/);
    assert.deepEqual(entries.map((entry) => entry.tool), ["sandbox_open", "sandbox_restore", "run_command", "sandbox_sync", "run_command"]);
  });

  it("leaves a command that isn't a build or test to the worktree shell", async () => {
    const calls: string[] = [];
    const { route } = routeWith(fakeClient(calls), ["make check"]);

    assert.equal(await route.run("git commit -m wip", worktreeRoot, null), null);
    assert.equal(await route.run("dotnet run --project src/Api", worktreeRoot, null), null);
    assert.notEqual(await route.run("make check", worktreeRoot, null), null);
    assert.deepEqual(calls.filter((call) => call.startsWith("run")), ["run /workspace/shop set -o pipefail; make check"]);
  });

  it("ends a filtered build with the build's own exit code, names its error count and asks for a restore when packages are missing", async () => {
    const calls: string[] = [];
    const missing: CommandResult = { ...passed, exitCode: 1, output: "error MSB4057: The target \"BundleMinify\" does not exist in the project.\n    0 Warning(s)\n    1 Error(s)" };
    const { route } = routeWith(fakeClient(calls, [missing]));

    const routed = await route.run("cd src/Web && dotnet build --no-restore 2>&1 | tail -5", worktreeRoot, null);

    assert.equal(calls.at(-1), "run /workspace/shop set -o pipefail; cd src/Web && dotnet build --no-restore 2>&1 | tail -5");
    assert.equal(routed?.exitCode, 1);
    assert.match(routed?.output ?? "", /: exit code 1 in 41\.0 s, 1 error\(s\)\./);
    assert.match(routed?.output ?? "", /\[Packages are missing: run sandbox_restore for the repo/);
  });

  it("gives a failed test run its exit code, and the failure lines of an output that was cut", async () => {
    const calls: string[] = [];
    const failed: CommandResult = { exitCode: 1, output: "Build succeeded.\n…\nFailed!  - Failed: 2, Passed: 10", truncated: true, timedOut: false, durationMs: 63_000, outputFile: "/workspace/.out/3.log" };
    const digest: CommandResult = { exitCode: 0, output: "  Failed Shop.Tests.Totals.AddsTax [12 ms]\n  Failed Shop.Tests.Totals.RoundsDown [3 ms]\n", truncated: false, timedOut: false, durationMs: 200, outputFile: "/workspace/.out/4.log" };
    const { route } = routeWith(fakeClient(calls, [failed, digest]));

    const routed = await route.run("dotnet test", worktreeRoot, null);

    assert.equal(routed?.exitCode, 1);
    assert.match(routed?.output ?? "", /its failure lines:\]\n {2}Failed Shop\.Tests\.Totals\.AddsTax \[12 ms\]\n {2}Failed Shop\.Tests\.Totals\.RoundsDown/);
    assert.match(calls.at(-1) ?? "", /^run \/workspace grep -E .* -- '\/workspace\/\.out\/3\.log'/);
  });

  it("answers a timed-out build with the shell's timeout code", async () => {
    const timedOut: CommandResult = { exitCode: null, output: "Building…", truncated: false, timedOut: true, durationMs: 600_000, outputFile: "/workspace/.out/1.log" };
    const { route } = routeWith(fakeClient([], [timedOut]));

    const routed = await route.run("dotnet build", worktreeRoot, null);

    assert.equal(routed?.exitCode, 124);
    assert.match(routed?.output ?? "", /timed out after 600\.0 s/);
  });

  it("runs routed commands one at a time, so a sync never lands under a running build", async () => {
    const order: string[] = [];
    let finishFirst = () => {};
    const client: Partial<SandboxClient> = {
      ...fakeClient([]),
      run: async (id, request) => {
        order.push(`start ${request.command}`);

        if (request.command.endsWith("dotnet build")) {
          await new Promise<void>((resolve) => { finishFirst = resolve; });
        }

        order.push(`end ${request.command}`);

        return { ok: true, value: passed };
      },
    };
    const { route } = routeWith(client);

    const build = route.run("dotnet build", worktreeRoot, null);
    const test = route.run("dotnet test", worktreeRoot, null);

    await new Promise((resolve) => setTimeout(resolve, 20));
    finishFirst();
    await Promise.all([build, test]);

    assert.deepEqual(order.map((step) => step.replace("set -o pipefail; ", "")), ["start dotnet build", "end dotnet build", "start dotnet test", "end dotnet test"]);
  });

  it("answers a failure to reach the sandbox as a failed command, not as the worktree shell's", async () => {
    const client: Partial<SandboxClient> = { ...fakeClient([]), open: async () => ({ ok: false, message: "The sandbox service at http://sandbox:3300 doesn't answer (fetch failed).", failure: "failed" }) };
    const { route, builds } = routeWith(client);

    const routed = await route.run("dotnet test", worktreeRoot, null);

    assert.equal(routed?.exitCode, 1);
    assert.match(routed?.output ?? "", /could not run in the run's sandbox: The sandbox service at http:\/\/sandbox:3300 doesn't answer/);
    assert.deepEqual(loggedRuns(builds), [{ command: "dotnet test", exitCode: null, problem: "The sandbox service at http://sandbox:3300 doesn't answer (fetch failed)." }]);
  });

  it("records each routed build and test in the run's build log, and run_command's too", async () => {
    const failed: CommandResult = { ...passed, exitCode: 1, output: "error CS1002: ; expected" };
    const { route, tools, builds } = routeWith(fakeClient([], [passed, failed, passed]));
    const runCommand = tools.find((tool) => tool.name === "run_command")!;

    await route.run("dotnet build Shop.sln", worktreeRoot, null);
    await route.run("dotnet test", worktreeRoot, null);
    await runCommand.handler({ command: "cd shop && dotnet build Shop.sln" });
    await runCommand.handler({ command: "ls shop" });

    assert.deepEqual(loggedRuns(builds), [
      { command: "dotnet build Shop.sln", exitCode: 0, problem: null },
      { command: "dotnet test", exitCode: 1, problem: null },
      { command: "cd shop && dotnet build Shop.sln", exitCode: 0, problem: null },
    ]);
    assert.deepEqual(builds.restores.map((restore) => [restore.repo, restore.ok]), [["shop", true]]);
  });

  it("builds on with a note when the first restore didn't fully succeed", async () => {
    const client: Partial<SandboxClient> = {
      ...fakeClient([]),
      restore: async (id, repo, target, tar) => { await tar.cancel(); return { ok: true, value: { ok: false, steps: [{ label: "dotnet restore Shop.sln", exitCode: 1, durationMs: 2_000, output: "NU1301" }], skipped: [], packagesPath: "/packages" } }; },
    };
    const { route, builds } = routeWith(client);

    const routed = await route.run("dotnet build", worktreeRoot, null);

    assert.equal(routed?.exitCode, 0);
    assert.match(routed?.output ?? "", /\[The package restore before it did not fully succeed: The restore did not fully succeed\./);
    assert.match(builds.runs[0].problem ?? "", /^The package restore before it did not fully succeed/);
  });
});
