import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadLog } from "../evidence/ReadLog";
import type { AutotestDraft } from "./models/AutotestDraft";
import { renderTestReport, resolveNewIds } from "./renderTestReport";
import { createReportTool } from "./reportTool";

const evidence = [{ source: "S0", ref: "PBI-1 acceptance criteria", note: "AC 2 expects a warning" }];

// S0 is the first message; the evidence quotes it.
function readLogWith(firstMessage: string): ReadLog {
  return new ReadLog(firstMessage);
}

function reportInput(overrides: object = {}) {
  return {
    goal: "Prove the transactions grid shows archived rows",
    status: "partial" as const,
    summary: "Two criteria, one test case; AC 2 has no test case.",
    analysis: [{ kind: "missing_test_case" as const, about: "AC 2", detail: "No test case checks the warning", evidence, resolution: "new:1" }],
    cases: [
      { ref: "TC-1234", title: "Archived rows listed", criterion: "AC 1: archived rows appear greyed", steps: ["Open Transactions", "Filter archived"], data: "facility 42", expected: "Rows greyed", state: "planned" as const },
      { ref: "agent", title: "Warning shown", criterion: "AC 2: a warning appears", steps: ["Archive a row"], data: "none", expected: "Warning banner", state: "blocked" as const, blocked_by: "new:1" },
    ],
    services: [{ name: "pvs-web", why: "owns the grid" }],
    results: [] as never[],
    ado_edits: [] as string[],
    next_reason: "The user must add the missing test case.",
    ...overrides,
  };
}

describe("write_test_report", () => {
  it("saves a report whose evidence the run read", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
    const tool = createReportTool(draft, readLogWith("AC 2 expects a warning"));

    const result = await tool.handler(reportInput());

    assert.match(result.text, /saved \(partial; 2 cases, 1 findings, 0 results\)/);
    assert.equal(draft.report?.cases[1].blockedBy, "new:1");
  });

  it("refuses a blocked case without the task that unblocks it", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
    const tool = createReportTool(draft, readLogWith("AC 2 expects a warning"));
    const cases = reportInput().cases.map((planned) => ({ ...planned, blocked_by: undefined }));

    const result = await tool.handler(reportInput({ cases }));

    assert.equal(result.isError, true);
    assert.match(result.text, /blocked case "Warning shown" needs blocked_by/);
    assert.equal(draft.report, null);
  });

  it("refuses evidence from a source the run never read", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
    const tool = createReportTool(draft, readLogWith("AC 2 expects a warning"));
    const analysis = reportInput().analysis.map((finding) => ({ ...finding, evidence: [{ ...evidence[0], source: "S5" }] }));

    const result = await tool.handler(reportInput({ analysis }));

    assert.equal(result.isError, true);
    assert.equal(draft.report, null);
  });
});

describe("renderTestReport", () => {
  it("resolves new:<n> to the created task ids and lays out findings and cases", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };

    await createReportTool(draft, readLogWith("AC 2 expects a warning")).handler(reportInput());

    const text = renderTestReport(draft.report!, ["HT-1-003"]);

    assert.match(text, /\*\*missing test case\*\* \(AC 2\): No test case checks the warning → HT-1-003/);
    assert.match(text, /### 2\. Warning shown \(agent\) — blocked by HT-1-003/);
    assert.match(text, /1\. Open Transactions\n2\. Filter archived\nData: facility 42\nExpected: Rows greyed/);
    assert.match(text, /## Services\n\n- pvs-web: owns the grid/);
  });

  it("resolves new:<n> inside free text too and leaves unknown numbers alone", () => {
    assert.equal(resolveNewIds("env from new:1; see new:2, then new:12", ["HT-1-003", "Q-1-004"]), "env from HT-1-003; see Q-1-004, then new:12");
  });
});
