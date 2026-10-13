import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { refinement } from "@powerloom/db";
import { ReadLog } from "../evidence/ReadLog";
import { loadPrompt } from "../prompts";
import { refinementBlock } from "../research/researchMessage";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { withTaskIds } from "./commitBetterRefinement";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import { createRefinementTool } from "./refinementTool";

type Input = Parameters<ReturnType<typeof createRefinementTool>["handler"]>[0];

const PBI = [{ source: "S0", ref: "PBI-36756 description", note: "the vendor shows as SexOffendersSearchProvider" }];

function emptyDraft(tasks: CreatedTask[] = []): BetterRefinementDraft {
  return { refinement: null, tasks, captures: [], pages: [] };
}

function input(overrides: Record<string, unknown> = {}): Input {
  return {
    summary: "The billable features report shows a raw provider key instead of the vendor name.",
    scope_in: ["Sex Offender sheet vendor column"],
    scope_out: ["Other sheets"],
    ac_gaps: [],
    sources: [{ what: "PBI description and notes", evidence: PBI }],
    repos: [{ name: "PVS", reason: "the report SP lives there", evidence: PBI }, { name: "VAPI v2", reason: "provider keys come from it", evidence: [] }],
    affected_areas: [{ area: "Billable Features report", change: "vendor column", evidence: PBI }],
    test_data: { applicable: true, given: [], missing: ["A tenant with SO transactions before June 2026, on QA2"], reason: "the symptom shows only in old data" },
    dependencies: [],
    blockers: [{ what: "Is the null provider id real on QA2?", resolved_by: "new:1", evidence: PBI }],
    assumptions: [],
    relevant_docs: [],
    skills: [],
    relevant_pages: [],
    status: "complete",
    next_reason: "The premise must be checked before a fix is planned.",
    ...overrides,
  } as Input;
}

const userTask = { assignee: "user", kind: "task" } as CreatedTask;

describe("write_refinement (Better Refinement)", () => {
  it("saves the readable columns and the details, marking unverified repos and listing blockers as dependencies", async () => {
    const draft = emptyDraft([userTask]);
    const tool = createRefinementTool(draft, new ReadLog("PBI-36756"), []);

    const result = await tool.handler(input());

    assert.equal(result.text, "Refinement saved (complete).");
    assert.deepEqual(draft.refinement?.repos.map((repo) => repo.reason), ["the report SP lives there (code: PBI-36756 description)", "provider keys come from it (unverified)"]);
    assert.deepEqual(draft.refinement?.dependencies, ["Blocker: Is the null provider id real on QA2? (resolved by new:1)"]);
    assert.equal(draft.refinement?.details.testData.missing.length, 1);
  });

  it("refuses a blocker whose task wasn't created and evidence the run never read", async () => {
    const draft = emptyDraft();
    const tool = createRefinementTool(draft, new ReadLog("PBI-36756"), []);
    const invented = [{ area: "Report SP", change: "join", evidence: [{ source: "S9", ref: "PVS/Database/report.sql", note: "assumed" }] }];

    const result = await tool.handler(input({ affected_areas: invented }));

    assert.equal(result.isError, true);
    assert.match(result.text, /cites S9, which this run never read/);
    assert.match(result.text, /resolved by "new:1", which is neither an item id nor a task you created/);
    assert.equal(draft.refinement, null);
  });
});

describe("withTaskIds", () => {
  it("gives blockers the ids their tasks got at the commit", async () => {
    const draft = emptyDraft([userTask]);

    await createRefinementTool(draft, new ReadLog("PBI-36756"), []).handler(input());

    const resolved = withTaskIds(draft.refinement!, ["HT-36756-004"]);

    assert.equal(resolved.details.blockers[0].resolvedBy, "HT-36756-004");
    assert.deepEqual(resolved.dependencies, ["Blocker: Is the null provider id real on QA2? (resolved by HT-36756-004)"]);
  });
});

describe("refinementBlock", () => {
  it("adds Better Refinement's details for research and design", async () => {
    const draft = emptyDraft([userTask]);

    await createRefinementTool(draft, new ReadLog("PBI-36756"), []).handler(input());

    const row = { ...draft.refinement!, version: 3, docsRead: [], details: draft.refinement!.details } as unknown as typeof refinement.$inferSelect;
    const block = refinementBlock(row);

    assert.match(block, /Affected areas:\n- Billable Features report: vendor column/);
    assert.match(block, /Test data:\n- missing: A tenant with SO transactions before June 2026, on QA2/);
    assert.match(block, /Blockers:\n- Is the null provider id real on QA2\? \(resolved by new:1\)/);
  });
});

describe("better-refinement prompt", () => {
  it("starts with the shared framework and records both versions", async () => {
    const prompt = await loadPrompt("better-refinement", { team: "Signals" });

    assert.equal(prompt.version, "v1+framework.v2");
    assert.match(prompt.text, /^## How you work/);
    assert.match(prompt.text, /You are Better Refinement for one PBI of the Signals team/);
  });
});
