import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildContent, BuildPlan } from "@powerloom/db";
import { decideSettlement } from "../generic/settleTask";
import { buildChecksOf } from "./buildChecks";
import { settlementBlocker } from "./buildGate";

const AT = "2026-10-29T10:00:00.000Z";
const COMMANDS = { build: "dotnet build Shop.sln", test: "dotnet test Shop.sln" };

function plan(id: string, status: BuildPlan["status"]): BuildPlan {
  return { id, phase: "01", wave: 1, objective: "", status, tasksDone: 0, tasksTotal: 1, changedFiles: [], oneLiner: "" };
}

function build(plans: BuildPlan[], buildExitCode: number | null): BuildContent {
  const check = { command: COMMANDS.build, exitCode: buildExitCode, at: AT, problem: null };

  return {
    summary: "", planVersion: 1, repo: "shop", branch: "powerloom/pbi-7", baseBranch: "main", worktree: "/w", headSha: "a1", commands: COMMANDS,
    checks: { build: check, test: null }, plans, commits: [], deviations: [], checkpoints: [], verification: [], uat: [],
    handOver: { state: "gaps", verdict: "", prTitle: "", itemId: null },
  };
}

describe("buildGate", () => {
  it("takes the last build and the last test the sandbox ran, by the repo's commands or the usual ones", () => {
    const runs = [
      { command: "dotnet build Shop.sln", exitCode: 0, problem: null, at: AT },
      { command: "dotnet restore", exitCode: 0, problem: null, at: AT },
      { command: "cd src && npm run build 2>&1 | tail -40", exitCode: 2, problem: null, at: AT },
      { command: "dotnet test Shop.sln --filter Totals", exitCode: 0, problem: null, at: AT },
    ];

    const checks = buildChecksOf(runs, COMMANDS);

    assert.equal(checks.build?.command, "cd src && npm run build 2>&1 | tail -40");
    assert.equal(checks.build?.exitCode, 2);
    assert.equal(checks.test?.command, "dotnet test Shop.sln --filter Totals");
    assert.deepEqual(buildChecksOf([], COMMANDS), { build: null, test: null });
  });

  it("blocks the task, instead of closing it done, when the saved build has no plan done or no passing build", () => {
    const noPlanDone = settlementBlocker(build([plan("01-01", "partial"), plan("01-02", "pending")], 0));
    const red = settlementBlocker(build([plan("01-01", "done")], 1));
    const unbuilt = settlementBlocker(build([plan("01-01", "done")], null));
    const settled = decideSettlement({ outcome: "success", result: null, handoffs: [{ intent: "review", toItemId: "XT-7-002" } as never], openWaitingFor: [], writers: [{ kind: "blocked", reason: noPlanDone! }] });

    assert.match(noPlanDone ?? "", /^The implementation was saved with 0 of 2 plans done: GSD's execute-phase finished no plan/);
    assert.match(red ?? "", /^The implementation was saved without a passing build of `dotnet build Shop\.sln` in the run's sandbox\./);
    assert.equal(unbuilt, red);
    assert.equal(settlementBlocker(build([plan("01-01", "done")], 0)), null);
    assert.equal(settlementBlocker({ ...build([plan("01-01", "done")], null), commands: { build: null, test: null } }), null);
    assert.deepEqual(settled, { kind: "block", reason: noPlanDone });
  });
});
