import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planningSnapshot, type PlanContent, type PowerLoomDb } from "@powerloom/db";
import type { PlanVersion } from "../models/PlanVersion";
import { readPbiReference } from "../pbiContext/readPbiReference";
import { planLines } from "./latestPlan";

const CONTENT: PlanContent = {
  summary: "Archive expired orders nightly.",
  decisions: [{ id: "D-01", phase: "01", text: "Run in the nightly job host." }],
  autoChoices: [],
  requirements: [{ id: "ORD-01", text: "Expired orders are archived.", complete: false, plans: ["01-01"] }],
  plans: [
    { id: "01-01", phase: "01", wave: 1, objective: "Archive orders past their expiry.", dependsOn: [], autonomous: true, requirements: ["ORD-01"], tasks: [], tests: [] },
    { id: "01-02", phase: "01", wave: 2, objective: "", dependsOn: ["01-01"], autonomous: true, requirements: [], tasks: [], tests: [] },
  ],
  checker: { verdict: "passed", issues: [] },
  risks: [],
  assumptions: [],
};

const LATEST: PlanVersion = { id: 3, pbiId: 7, version: 2, runId: 41, createdAt: new Date("2026-10-29T10:00:00Z"), plan: CONTENT };

// Answers the latest-plan query of the planning_snapshot table with the given rows; any other table has none.
function dbWith(rows: PlanVersion[]): PowerLoomDb {
  const query = (table: unknown) => ({ where: () => ({ orderBy: () => ({ limit: async () => (table === planningSnapshot ? rows : []) }) }) });

  return { select: () => ({ from: query }) } as unknown as PowerLoomDb;
}

describe("planLines", () => {
  it("names the version, the summary and each plan with its wave", () => {
    assert.deepEqual(planLines(LATEST), ["Plan v2: Archive expired orders nightly.", "Plans:", "- 01-01 (wave 1): Archive orders past their expiry.", "- 01-02 (wave 2): -"]);
  });
});

describe("readPbiReference PBI-<id>:plan", () => {
  it("reads the latest plan with the run that wrote it", async () => {
    const outcome = await readPbiReference(dbWith([LATEST]), "", "PBI-7:plan");

    assert.equal(outcome.ok, true);
    const read = JSON.parse(outcome.ok ? outcome.value : "{}");
    assert.equal(read.version, 2);
    assert.equal(read.run, "RUN-41");
    assert.equal(read.summary, CONTENT.summary);
    assert.deepEqual(read.requirements, CONTENT.requirements);
  });

  it("says when the PBI has no plan yet", async () => {
    const outcome = await readPbiReference(dbWith([]), "", "PBI-7:plan");

    assert.equal(outcome.ok, false);
  });
});
