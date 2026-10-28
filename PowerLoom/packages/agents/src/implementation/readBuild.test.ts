import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildSource } from "./models/BuildSource";
import { readBuild } from "./readBuild";

const PLACE = { repo: "shop", branch: "powerloom/pbi-7", baseBranch: "main", worktree: "/cache/.worktrees/demo/shop/powerloom-pbi-7", planVersion: 2, commands: { build: null, test: "dotnet test" } };
const REPORTED = { summary: "Expired orders are archived nightly.", prTitle: "Archive expired orders", verdict: "phase 01 passed 3/3", checkpoints: [] };

const INSPECT = {
  schema_version: 1,
  phases: [{
    dir: "01-archive",
    phase_id: "01",
    verification: { status: "gaps_found" },
    uat: { unresolved: [{ test: 3, name: "Old orders still load", result: "pending", reason: "needs a real database" }] },
    plans: [
      { id: "01-01", file: "01-01-PLAN.md", wave: 1, objective: "Archive orders.", hasSummary: true, changedFiles: ["Orders/Archive.cs"], tasks: [{ name: "a" }, { name: "b" }] },
      { id: "01-02", file: "01-02-PLAN.md", wave: 2, objective: "Report archived orders.", tasks: [{ name: "c", status: "done" }, { name: "d", status: "pending" }] },
      { id: "01-00", file: "01-00-PLAN.md", superseded: true, tasks: [] },
    ],
  }],
};

const SUMMARY = [
  "---", "phase: 01-archive", "plan: 01", "---", "", "# Phase 01: Archive Summary", "", "**Nightly job archives orders past their expiry**", "",
  "## Deviations from Plan", "", "### Auto-fixed Issues", "", "**1. [Rule 1 - Bug] Expiry compared in local time**", "- **Fix:** compare in UTC", "",
  "## Issues Encountered", "None",
].join("\n");

const VERIFICATION = [
  "---", "phase: 01-archive", "status: passed", "score: 3/3 must-haves verified", "---", "", "## Goal Achievement", "", "### Observable Truths", "",
  "| # | Truth | Status | Evidence |", "|---|-------|--------|----------|", "| 1 | Expired orders are archived | ✓ VERIFIED | ArchiveTests pass |", "",
  "### Required Artifacts", "| Artifact | Expected | Status | Details |",
].join("\n");

const FILES: Record<string, string> = {
  "phases/01-archive/01-01-SUMMARY.md": SUMMARY,
  "phases/01-archive/01-VERIFICATION.md": VERIFICATION,
};

function source(inspect: unknown = INSPECT, files: Record<string, string> = FILES): BuildSource {
  return {
    planning: { inspect: async () => inspect, read: async (path) => files[path] ?? null },
    commits: async (base) => (base === "main" ? [{ sha: "a1", message: "feat(01-01): archive expired orders" }, { sha: "b2", message: "test(01-02): report" }] : []),
    head: async () => "b2",
  };
}

describe("readBuild", () => {
  it("reads each plan's progress, its summary's one-liner and the branch's commits since its base", async () => {
    const reading = await readBuild(source(), PLACE, REPORTED);
    const content = reading.ok ? reading.content : assert.fail("not read");

    assert.deepEqual(content.plans.map((plan) => [plan.id, plan.status, plan.tasksDone, plan.tasksTotal]), [["01-01", "done", 2, 2], ["01-02", "partial", 1, 2]]);
    assert.equal(content.plans[0].oneLiner, "Nightly job archives orders past their expiry");
    assert.deepEqual(content.plans[0].changedFiles, ["Orders/Archive.cs"]);
    assert.deepEqual(content.commits.map((commit) => commit.sha), ["a1", "b2"]);
    assert.equal(content.headSha, "b2");
    assert.equal(content.planVersion, 2);
  });

  it("reads deviations, the verification matrix and the open UAT items", async () => {
    const reading = await readBuild(source(), PLACE, REPORTED);
    const content = reading.ok ? reading.content : assert.fail("not read");

    assert.deepEqual(content.deviations, [{ plan: "01-01", text: "[Rule 1 - Bug] Expiry compared in local time" }]);
    assert.deepEqual(content.verification, [{ phase: "01", status: "passed", score: "3/3 must-haves verified", truths: [{ truth: "Expired orders are archived", status: "✓ VERIFIED", evidence: "ArchiveTests pass" }] }]);
    assert.deepEqual(content.uat, [{ phase: "01", test: "3", name: "Old orders still load", result: "pending", reason: "needs a real database" }]);
  });

  it("hands over with gaps while a plan isn't done, for a person when tests are open, and ready otherwise", async () => {
    const allDone = { ...INSPECT, phases: [{ ...INSPECT.phases[0], plans: [INSPECT.phases[0].plans[0]] }] };
    const noUat = { ...allDone, phases: [{ ...allDone.phases[0], uat: { unresolved: [] } }] };
    const states = await Promise.all([source(), source(allDone), source(noUat)].map(async (built) => {
      const reading = await readBuild(built, PLACE, REPORTED);

      return reading.ok ? reading.content.handOver.state : "not read";
    }));

    assert.deepEqual(states, ["gaps", "needs-person", "ready"]);
  });

  it("takes inspect's status for a phase without a verification report, and counts one without either as a gap", async () => {
    const unverified = { ...INSPECT, phases: [{ ...INSPECT.phases[0], verification: {}, uat: {}, plans: [INSPECT.phases[0].plans[0]] }] };
    const inspected = await readBuild(source(INSPECT, {}), PLACE, REPORTED);
    const missing = await readBuild(source(unverified, {}), PLACE, REPORTED);

    assert.equal(inspected.ok ? inspected.content.verification[0].status : "", "gaps_found");
    assert.equal(missing.ok ? missing.content.verification[0].status : "", "missing");
    assert.equal(missing.ok ? missing.content.handOver.state : "", "gaps");
  });

  it("refuses another inspect schema and a snapshot without plans", async () => {
    const other = await readBuild(source({ schema_version: 2 }), PLACE, REPORTED);
    const empty = await readBuild(source({ schema_version: 1, phases: [] }), PLACE, REPORTED);

    assert.deepEqual(other, { ok: false, problem: "planning inspect schema_version 2 is not supported (only 1)" });
    assert.deepEqual(empty, { ok: false, problem: "planning inspect lists no plan: there is nothing built to record" });
  });
});
