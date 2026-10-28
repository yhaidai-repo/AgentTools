import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanningFolder } from "./models/PlanningFolder";
import { readPlan } from "./readPlan";

const REPORTED = { summary: "Archive expired orders nightly.", checker: { verdict: "passed" as const, issues: [] }, assumptions: ["The job's log lines follow the repo's logger format."] };

const INSPECT = {
  schema_version: 1,
  phases: [{
    dir: "01-expiry-archive",
    phase_id: "01",
    plans: [
      {
        id: "01-01",
        file: "01-01-PLAN.md",
        superseded: false,
        objective: "Archive orders past their expiry.",
        wave: 1,
        dependsOn: [],
        autonomous: true,
        tasks: [{ name: "Task 1: Archiver", type: "tracer", plannedFiles: ["src/Orders/OrderArchiver.cs"], done: "Expired orders are archived.", status: "pending" }],
      },
      { id: "01-02", file: "01-02-PLAN.md", superseded: true, wave: 1, tasks: [] },
      { id: "01-03", file: "01-03-PLAN.md", wave: 2, dependsOn: ["01-01"], tasks: [] },
    ],
  }],
  requirements: [
    { id: "ORD-01", text: "Expired orders are archived.", complete: false },
    { id: "ORD-02", text: "Archived orders stay readable.", complete: false },
    { id: "ORD-03", text: "Admins see the archive count.", complete: false },
  ],
};

const PLAN_01 = [
  "---",
  "phase: 01-expiry-archive",
  "wave: 1",
  "requirements: [ORD-01, ORD-02]",
  "---",
  "<tasks>",
  "<task type=\"tracer\">…</task>",
  "</tasks>",
  "",
  "## Flagged Assumptions (spec-less edge probes, unresolved)",
  "",
  "- **ORD-02:** assumes archived rows keep their ids.",
  "",
  "## Artifacts this phase produces",
  "- New class `OrderArchiver`",
  "",
  "<threat_model>",
  "## Trust Boundaries",
  "",
  "| Boundary | Description |",
  "|----------|-------------|",
  "| Job -> DB | archive writes |",
  "",
  "## STRIDE Threat Register",
  "",
  "| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |",
  "|-----------|----------|-----------|----------|-------------|-----------------|",
  "| T-01-01 | Tampering | OrderArchiver | medium | mitigate | Archive in one transaction per batch; covered by a rollback test |",
  "</threat_model>",
  "",
  "<verification>",
  "- `dotnet test` passes",
  "- No order newer than its expiry is archived",
  "</verification>",
].join("\n");

const PLAN_03 = ["---", "requirements:", "  - ORD-02", "---", "<verification>", "- Reads of archived orders return them", "</verification>"].join("\n");

const CONTEXT = [
  "# Phase 1: Expiry archive - Context",
  "<decisions>",
  "## Implementation Decisions",
  "",
  "### Where",
  "- **D-01:** The archiver runs in the existing nightly job host.",
  "- **D-02:** Batches of",
  "  500 orders per transaction.",
  "",
  "### Claude's Discretion",
  "- The log wording.",
  "</decisions>",
].join("\n");

const DISCUSSION_LOG = [
  "# Phase 1: Discussion Log",
  "**Mode:** `--auto`",
  "",
  "## Batch size",
  "",
  "| Option | Description | Selected |",
  "**User's choice:** [auto] 500 per batch (recommended default)",
  "",
  "## Schedule",
  "",
  "**User's choice:** [auto] Nightly (recommended default)",
].join("\n");

function folderOf(inspect: unknown, files: Record<string, string>): PlanningFolder {
  return {
    inspect: async () => inspect,
    read: async (path) => files[path] ?? null,
  };
}

const FILES = {
  "phases/01-expiry-archive/01-01-PLAN.md": PLAN_01,
  "phases/01-expiry-archive/01-03-PLAN.md": PLAN_03,
  "phases/01-expiry-archive/01-CONTEXT.md": CONTEXT,
  "phases/01-expiry-archive/01-DISCUSSION-LOG.md": DISCUSSION_LOG,
};

describe("readPlan", () => {
  it("reads plans by wave with their tasks, requirements and checks, leaving superseded plans out", async () => {
    const reading = await readPlan(folderOf(INSPECT, FILES), REPORTED);

    assert.equal(reading.ok, true);
    const plan = reading.ok ? reading.content : assert.fail();
    assert.deepEqual(plan.plans.map((item) => [item.id, item.wave, item.requirements]), [["01-01", 1, ["ORD-01", "ORD-02"]], ["01-03", 2, ["ORD-02"]]]);
    assert.deepEqual(plan.plans[0].tasks, [{ name: "Task 1: Archiver", type: "tracer", files: ["src/Orders/OrderArchiver.cs"], done: "Expired orders are archived.", status: "pending" }]);
    assert.deepEqual(plan.plans[0].tests, ["`dotnet test` passes", "No order newer than its expiry is archived"]);
    assert.deepEqual(plan.plans[1].dependsOn, ["01-01"]);
  });

  it("covers each requirement with the plans that name it and shows the one none names", async () => {
    const reading = await readPlan(folderOf(INSPECT, FILES), REPORTED);
    const plan = reading.ok ? reading.content : assert.fail();

    assert.deepEqual(plan.requirements.map((item) => [item.id, item.plans]), [["ORD-01", ["01-01"]], ["ORD-02", ["01-01", "01-03"]], ["ORD-03", []]]);
  });

  it("takes decisions with their detail lines, the [auto] choices per area, the threat register and the flagged assumptions", async () => {
    const reading = await readPlan(folderOf(INSPECT, FILES), REPORTED);
    const plan = reading.ok ? reading.content : assert.fail();

    assert.deepEqual(plan.decisions, [
      { id: "D-01", phase: "01", text: "The archiver runs in the existing nightly job host." },
      { id: "D-02", phase: "01", text: "Batches of 500 orders per transaction." },
    ]);
    assert.deepEqual(plan.autoChoices, [
      { phase: "01", area: "Batch size", choice: "500 per batch (recommended default)" },
      { phase: "01", area: "Schedule", choice: "Nightly (recommended default)" },
    ]);
    assert.deepEqual(plan.risks, [{ id: "T-01-01", plan: "01-01", category: "Tampering", component: "OrderArchiver", severity: "medium", disposition: "mitigate", mitigation: "Archive in one transaction per batch; covered by a rollback test" }]);
    assert.deepEqual(plan.assumptions, ["The job's log lines follow the repo's logger format.", "**ORD-02:** assumes archived rows keep their ids."]);
  });

  it("keeps the agent's summary and checker verdict and the inspect snapshot as it came", async () => {
    const reading = await readPlan(folderOf(INSPECT, FILES), { ...REPORTED, checker: { verdict: "issues", issues: ["Plan 01-03 has no failing direction"] } });

    assert.equal(reading.ok, true);
    assert.deepEqual(reading.ok && reading.content.checker, { verdict: "issues", issues: ["Plan 01-03 has no failing direction"] });
    assert.equal(reading.ok && reading.content.summary, REPORTED.summary);
    assert.equal(reading.ok && reading.inspect, INSPECT);
  });

  it("refuses an inspect schema_version other than 1", async () => {
    const reading = await readPlan(folderOf({ ...INSPECT, schema_version: 2 }, FILES), REPORTED);

    assert.deepEqual(reading, { ok: false, problem: "planning inspect schema_version 2 is not supported (only 1)" });
  });

  it("refuses inspect output that is no object, and a planning folder without plans", async () => {
    assert.deepEqual(await readPlan(folderOf(null, FILES), REPORTED), { ok: false, problem: "planning inspect returned no JSON object" });
    assert.match((await readPlan(folderOf({ schema_version: 1, phases: [], requirements: [] }, {}), REPORTED) as { problem: string }).problem, /lists no plan yet/);
  });
});
