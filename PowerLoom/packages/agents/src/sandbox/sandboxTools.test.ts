import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { SandboxClient } from "@powerloom/sandbox";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import type { RepoAccess } from "../models/RepoAccess";
import type { RunWorktree } from "./models/RunWorktree";
import type { RunWorktreeSlot } from "./models/RunWorktreeSlot";
import { SANDBOX_INTEGRATION, createSandboxTools } from "./sandboxTools";

const feed = { urlPrefixes: ["https://pkgs.dev.azure.com/acme/"], username: "powerloom", password: "pat" };
const context = { vault: "work-projects", agentId: "tester", runId: 7, owner: "powerloom-run-7", taskId: "AT-1-001", pbiId: 1 };
const info = { id: "abc123", owner: "powerloom-run-7", expiresAt: "2026-10-28T12:00:00.000Z", workspace: "/workspace", image: "powerloom-sandbox", toolchains: "dotnet 10, node 24" };
// The repo cache the snapshot reads: one checkout folder.
const cacheRoot = mkdtempSync(join(tmpdir(), "sandbox-tools-"));
mkdirSync(join(cacheRoot, "orders-api"));
writeFileSync(join(cacheRoot, "orders-api", "cached.cs"), "");

// The run's worktree of orders-api, where the agent commits.
const worktreeRoot = mkdtempSync(join(tmpdir(), "sandbox-worktree-"));
const worktree: RunWorktree = { repo: "orders-api", path: worktreeRoot };

const repos: RepoAccess = { isOn: true, repos: [{ name: "orders-api", remoteUrl: "", defaultBranch: "main" }], commits: { "orders-api": "0123456789abcdef" }, tools: [] };

function agentWith(sandbox: boolean): AgentDefinition {
  return { capabilities: { webAccess: false, integrations: { [SANDBOX_INTEGRATION]: sandbox } }, limits: { maxTurns: 40, timeoutMinutes: 20 } } as unknown as AgentDefinition;
}

function depsWith(client: Partial<SandboxClient> | null, runWorktree?: RunWorktreeSlot): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const sandbox = client ? { client: client as SandboxClient, url: "http://sandbox:3300", feeds: [feed], packageHosts: ["api.nuget.org"], image: "" } : null;

  return { deps: { outside, sandbox, repoCache: { root: cacheRoot }, runWorktree } as unknown as AgentDeps, entries };
}

function toolsOf(deps: AgentDeps) {
  const tools = createSandboxTools(deps, agentWith(true), context, repos);

  return (name: string) => tools.find((tool) => tool.name === name)!;
}

function fakeClient(calls: string[]): Partial<SandboxClient> {
  return {
    open: async (request) => { calls.push(`open ${request.owner} ${request.ttlMinutes}`); return { ok: true, value: info }; },
    uploadRepo: async (id, name, tar, message) => { calls.push(`upload ${id} ${name} ${message}`); await tar.cancel(); return { ok: true, value: { path: `/workspace/${name}`, files: 3 } }; },
    run: async (id, request) => { calls.push(`run ${id} ${request.command}`); return { ok: true, value: { exitCode: 1, output: "1 failed", truncated: false, timedOut: false, durationMs: 2_500, outputFile: "/workspace/.out/1.log" } }; },
    remove: async (id) => { calls.push(`remove ${id}`); return { ok: true, value: { owners: ["powerloom-run-7"] } }; },
  };
}

describe("createSandboxTools", () => {
  it("gives no tools while the agent's switch is off or the host has no sandbox service", () => {
    assert.equal(createSandboxTools(depsWith({}).deps, agentWith(false), context, repos).length, 0);
    assert.equal(createSandboxTools(depsWith(null).deps, agentWith(true), context, repos).length, 0);
  });

  it("gives the same tools to every provider, in the models' own shapes", () => {
    const names = createSandboxTools(depsWith({}).deps, agentWith(true), context, repos).map((tool) => tool.name);

    assert.deepEqual(names, ["sandbox_open", "sandbox_restore", "run_command", "exec_command", "write_stdin", "apply_patch", "edit_file", "write_file", "sandbox_close"]);
  });

  it("opens the run's sandbox, copies the repos in at their commit, runs a command and removes it", async () => {
    const calls: string[] = [];
    const { deps, entries } = depsWith(fakeClient(calls));
    const tool = toolsOf(deps);

    const opened = await tool("sandbox_open").handler({});
    const ran = await tool("run_command").handler({ command: "dotnet test", cwd: "orders-api" });
    const closed = await tool("sandbox_close").handler({});

    assert.deepEqual(calls, ["open powerloom-run-7 30", "upload abc123 orders-api base 0123456789abcdef", "run abc123 set -o pipefail; dotnet test", "remove abc123"]);
    assert.match(opened.text, /\/workspace\/orders-api \(commit 0123456789ab\)/);
    assert.match(opened.text, /Toolchains: dotnet 10, node 24/);
    assert.equal(ran.text, "Exit code 1 (2.5 s)\n1 failed");
    assert.match(closed.text, /removed/);
    assert.deepEqual(entries.map((entry) => [entry.tool, entry.kind, entry.outcome]), [["sandbox_open", "sandbox", "ok"], ["run_command", "sandbox", "ok"], ["sandbox_close", "sandbox", "ok"]]);
    assert.equal(entries[1].request, "dotnet test");
  });

  it("refuses a repo the run doesn't have", async () => {
    const calls: string[] = [];
    const result = await toolsOf(depsWith(fakeClient(calls)).deps)("sandbox_open").handler({ repos: ["billing"] });

    assert.equal(result.isError, true);
    assert.match(result.text, /Not repos of this run: billing\. Your repos: orders-api/);
    assert.deepEqual(calls, []);
  });

  it("asks for sandbox_open before a command", async () => {
    const result = await toolsOf(depsWith(fakeClient([])).deps)("run_command").handler({ command: "ls" });

    assert.equal(result.isError, true);
    assert.match(result.text, /call sandbox_open first/);
  });

  it("explains a command that can't work and logs it as refused", async () => {
    const calls: string[] = [];
    const { deps, entries } = depsWith(fakeClient(calls));
    const result = await toolsOf(deps)("run_command").handler({ command: "git add . && git push origin main" });

    assert.equal(result.isError, true);
    assert.match(result.text, /no network/);
    assert.deepEqual(calls, []);
    assert.equal(entries[0].outcome, "refused");
  });

  it("passes a rule's refusal from the service on as refused", async () => {
    const client: Partial<SandboxClient> = { ...fakeClient([]), run: async () => ({ ok: false, message: "The workspace uses 21000 MB", failure: "refused" }) };
    const { deps, entries } = depsWith(client);
    const tool = toolsOf(deps);

    await tool("sandbox_open").handler({});

    const result = await tool("run_command").handler({ command: "make" });

    assert.equal(result.isError, true);
    assert.equal(entries[1].outcome, "refused");
  });

  it("answers a session in Codex's words and logs typed input cut short", async () => {
    const client: Partial<SandboxClient> = { ...fakeClient([]), writeStdin: async (id, sessionId) => ({ ok: true, value: { sessionId, output: "listening on 5000\n", truncated: false, running: true, exitCode: null } }) };
    const { deps, entries } = depsWith(client);
    const tool = toolsOf(deps);

    await tool("sandbox_open").handler({});

    const result = await tool("write_stdin").handler({ session_id: "s1", chars: "" });

    assert.equal(result.text, "Process running with session ID s1\nOutput:\nlistening on 5000\n");
    assert.equal(entries[1].request, "session s1: \"\"");
  });

  it("logs which files a patch touches, not its text", async () => {
    const client: Partial<SandboxClient> = { ...fakeClient([]), applyPatch: async () => ({ ok: true, value: { changed: [{ path: "/workspace/a.ts", op: "update" }] } }) };
    const { deps, entries } = depsWith(client);
    const tool = toolsOf(deps);

    await tool("sandbox_open").handler({});

    const result = await tool("apply_patch").handler({ input: "*** Begin Patch\n*** Update File: a.ts\n-secret\n+x\n*** End Patch" });

    assert.equal(result.text, "Done:\nupdate /workspace/a.ts");
    assert.equal(entries[1].request, "patch a.ts");
  });

  it("restores from the cached repo with the vault's feed sign-in and reports each step", async () => {
    const sent: unknown[] = [];
    const client: Partial<SandboxClient> = {
      ...fakeClient([]),
      restore: async (id, repo, target, tar, credentials, hosts) => {
        sent.push([id, repo, target, credentials, hosts]);
        await tar.cancel();

        return { ok: true, value: { ok: false, steps: [{ label: "dotnet restore App.sln", exitCode: 1, durationMs: 4_000, output: "NU1301: unable to load" }], skipped: [], packagesPath: "/packages" } };
      },
    };
    const { deps } = depsWith(client);
    const tool = toolsOf(deps);

    await tool("sandbox_open").handler({});

    const result = await tool("sandbox_restore").handler({ repo: "orders-api", target: "App.sln" });

    assert.deepEqual(sent, [["abc123", "orders-api", "App.sln", [feed], ["api.nuget.org"]]]);
    assert.equal(result.isError, true);
    assert.match(result.text, /- dotnet restore App\.sln: failed \(exit code 1\) in 4\.0 s/);
    assert.match(result.text, /NU1301/);
  });

  it("restores only a repo the sandbox has", async () => {
    const result = await toolsOf(depsWith(fakeClient([])).deps)("sandbox_restore").handler({ repo: "orders-api" });

    assert.match(result.text, /call sandbox_open first/);
  });

  it("adds sandbox_sync only for a run that can have a worktree", () => {
    const withSlot = createSandboxTools(depsWith({}, { current: null }).deps, agentWith(true), context, repos).map((tool) => tool.name);
    const without = createSandboxTools(depsWith({}).deps, agentWith(true), context, repos).map((tool) => tool.name);

    assert.deepEqual(withSlot.slice(0, 3), ["sandbox_open", "sandbox_sync", "sandbox_restore"]);
    assert.equal(without.includes("sandbox_sync"), false);
  });

  it("reads the worktree when a tool is called, as the runner tells it after the tools are built", async () => {
    const calls: string[] = [];
    const slot: RunWorktreeSlot = { current: null };
    const tool = toolsOf(depsWith(fakeClient(calls), slot).deps);

    slot.current = worktree;
    await tool("sandbox_open").handler({});

    assert.deepEqual(calls, ["open powerloom-run-7 30", "upload abc123 orders-api your worktree"]);
  });

  it("copies the cached checkout for a repo that isn't the worktree's", async () => {
    const calls: string[] = [];
    const other = { ...repos, repos: [...repos.repos, { name: "billing", remoteUrl: "", defaultBranch: "main" }] };
    mkdirSync(join(cacheRoot, "billing"), { recursive: true });
    const tools = createSandboxTools(depsWith(fakeClient(calls), { current: worktree }).deps, agentWith(true), context, other);

    await tools.find((tool) => tool.name === "sandbox_open")!.handler({});

    assert.deepEqual(calls, ["open powerloom-run-7 30", "upload abc123 orders-api your worktree", "upload abc123 billing base unknown"]);
  });

  it("says a sync has nothing to do in a run with no worktree", async () => {
    const calls: string[] = [];
    const tool = toolsOf(depsWith(fakeClient(calls), { current: null }).deps);

    await tool("sandbox_open").handler({});
    const result = await tool("sandbox_sync").handler({});

    assert.match(result.text, /no worktree/);
    assert.equal(calls.length, 2);
  });

  it("copies the cached checkout when the run has no worktree", async () => {
    const calls: string[] = [];
    const result = await toolsOf(depsWith(fakeClient(calls)).deps)("sandbox_open").handler({});

    assert.deepEqual(calls, ["open powerloom-run-7 30", "upload abc123 orders-api base 0123456789abcdef"]);
    assert.match(result.text, /commit 0123456789ab/);
  });

  it("copies the worktree's repo from the worktree and sync recopies its current files", async () => {
    const calls: string[] = [];
    const uploads: string[] = [];
    const client: Partial<SandboxClient> = {
      ...fakeClient(calls),
      uploadRepo: async (id, name, tar, message) => {
        calls.push(`upload ${id} ${name} ${message}`);
        uploads.push(Buffer.from(await new Response(tar).arrayBuffer()).toString("latin1"));

        return { ok: true, value: { path: `/workspace/${name}`, files: 1 } };
      },
    };
    const tool = toolsOf(depsWith(client, { current: worktree }).deps);

    writeFileSync(join(worktreeRoot, "gone.cs"), "");

    const opened = await tool("sandbox_open").handler({});

    rmSync(join(worktreeRoot, "gone.cs"));
    writeFileSync(join(worktreeRoot, "committed.cs"), "");

    const synced = await tool("sandbox_sync").handler({});

    assert.deepEqual(calls, ["open powerloom-run-7 30", "upload abc123 orders-api your worktree", "upload abc123 orders-api synced from your worktree"]);
    assert.match(opened.text, /\/workspace\/orders-api \(your worktree's files\)/);
    assert.match(uploads[0], /gone\.cs/);
    assert.doesNotMatch(uploads[0], /cached\.cs/);
    assert.match(uploads[1], /committed\.cs/);
    assert.doesNotMatch(uploads[1], /gone\.cs/);
    assert.equal(synced.text, "Synced 1 files into /workspace/orders-api.");
  });

  it("asks for sandbox_open before a sync", async () => {
    const calls: string[] = [];
    const result = await toolsOf(depsWith(fakeClient(calls), { current: worktree }).deps)("sandbox_sync").handler({});

    assert.match(result.text, /call sandbox_open first/);
    assert.deepEqual(calls, []);
  });

  it("restores from the cached checkout at the run's commit even with a worktree", async () => {
    const restored: string[] = [];
    const client: Partial<SandboxClient> = {
      ...fakeClient([]),
      restore: async (id, repo, target, tar) => {
        restored.push(Buffer.from(await new Response(tar).arrayBuffer()).toString("latin1"));

        return { ok: true, value: { ok: true, steps: [], skipped: [], packagesPath: "/packages" } };
      },
    };
    const tool = toolsOf(depsWith(client, { current: worktree }).deps);

    await tool("sandbox_open").handler({});
    await tool("sandbox_restore").handler({ repo: "orders-api" });

    assert.match(restored[0], /cached\.cs/);
    assert.match(tool("sandbox_restore").description, /unchanged files at the run's commit, not your edits/);
  });

  it("sends the packages to add with the restore and names the versions it chose", async () => {
    const sent: unknown[] = [];
    const client: Partial<SandboxClient> = {
      ...fakeClient([]),
      restore: async (id, repo, target, tar, credentials, hosts, additions) => {
        sent.push(additions);
        await tar.cancel();

        return { ok: true, value: { ok: true, steps: [{ label: "dotnet add src/Api/Api.csproj package Polly", exitCode: 0, durationMs: 9_000, output: "info : PackageReference for package 'Polly' version '8.4.2' added to file 'Api.csproj'." }], skipped: [], packagesPath: "/packages" } };
      },
    };
    const tool = toolsOf(depsWith(client).deps);

    await tool("sandbox_open").handler({});

    const result = await tool("sandbox_restore").handler({ repo: "orders-api", packages: [{ project: "src/Api/Api.csproj", id: "Polly" }] });

    assert.deepEqual(sent, [[{ project: "src/Api/Api.csproj", id: "Polly" }]]);
    assert.match(result.text, /- added package 'Polly' version '8\.4\.2'/);
  });

  it("opens the sandbox on the vault's package cache", async () => {
    const opened: unknown[] = [];
    const client: Partial<SandboxClient> = { ...fakeClient([]), open: async (request) => { opened.push(request.packageCache); return { ok: true, value: info }; } };
    const { deps } = depsWith(client);

    deps.sandbox!.packageCache = "work-projects";
    await toolsOf(deps)("sandbox_open").handler({});

    assert.deepEqual(opened, ["work-projects"]);
  });

  it("refuses dotnet add package in run_command and points at the restore", async () => {
    const result = await toolsOf(depsWith(fakeClient([])).deps)("run_command").handler({ command: "cd orders-api && dotnet add src/Api/Api.csproj package Polly" });

    assert.equal(result.isError, true);
    assert.match(result.text, /sandbox_restore's `packages`/);
  });
});
