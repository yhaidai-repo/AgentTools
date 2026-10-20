import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { noRepos } from "../repos/openRepos";
import type { PreviousReport } from "./models/PreviousReport";
import type { TestReport } from "./models/TestReport";
import { renderTestReport } from "./renderTestReport";
import { composeTestMessage } from "./testMessage";

type ItemRow = typeof localItem.$inferSelect;

const task = { id: "TT-30474-001", title: "Test PBI 30474", body: null, data: { goal: "Prove the criteria", depth: 1, dependsOn: ["Q-30474-004"] } } as unknown as ItemRow;
const pbiMessage = "<pbi>PBI-30474</pbi>\n\n<existing-items>\n- Q-30474-004 (question, answered): Run this plan?\n  Answer: yes\n</existing-items>";

const report: TestReport = {
  goal: "Prove the Full Report criteria",
  status: "partial",
  summary: "Seven cases passed; two wait for test data.",
  analysis: [{ kind: "missing_test_data", about: "AC 3", detail: "No request with code XB", evidence: [], resolution: "Q-30474-007" }],
  cases: [
    { ref: "TC-100", title: "Full Report shows the summary", criterion: "AC 1", steps: ["Open /Customer/Request", "Click Full Report"], data: "request 1190908", expected: "The summary section is shown", state: "planned", blockedBy: null },
    { ref: "agent", title: "API returns 200 for XB", criterion: "AC 3", steps: ["GET /api/requests/1 with the key"], data: "none", expected: "200 with the XB row", state: "blocked", blockedBy: "Q-30474-007" },
    { ref: "TC-101", title: "Export works", criterion: "AC 4", steps: ["Click Export"], data: "", expected: "A file downloads", state: "planned", blockedBy: null },
  ],
  services: [{ name: "pvs-web", why: "owns the screen" }, { name: "pvs-api", why: "called by the portal" }],
  results: [
    { case: "Full Report shows the summary", criterion: "AC 1", verdict: "pass", observed: "Summary visible", artifacts: ["stack/browser/run/case-1/trace.zip"], bug: null },
    { case: "API returns 200 for XB", criterion: "AC 3", verdict: "blocked", observed: "No XB data; waits for Q-30474-007", artifacts: [], bug: null },
    { case: "Export works", criterion: "AC 4", verdict: "not_run", observed: "Time ran out", artifacts: [], bug: null },
  ],
  adoEdits: [],
  nextReason: "Q-30474-007 brings the XB data.",
};

const previous: PreviousReport = { id: "TR-30474-012", report };

describe("composeTestMessage", () => {
  it("asks for the analysis and the plan when the task has no report yet", () => {
    const message = composeTestMessage(task, 30474, pbiMessage, null, noRepos());

    assert.match(message, /^Test this PBI: analyse its acceptance criteria/);
    assert.doesNotMatch(message, /<previous-report>/);
    assert.match(message, /Waited for: Q-30474-004/);
    assert.match(message, /read_test_cases: the Azure DevOps test cases of PBI-30474/);
  });

  it("continues from the latest report: its plan, the kept verdicts and the cases still to run with what blocks them", () => {
    const message = composeTestMessage(task, 30474, pbiMessage, previous, noRepos());

    assert.match(message, /^Test this PBI: continue from the task's latest report below/);
    assert.match(message, /<previous-report>\nTR-30474-012 \(status partial\)/);
    assert.match(message, /cite TR-30474-012 as their evidence \(source S0\)/);
    assert.match(message, /- missing test data \(AC 3\): No request with code XB → Q-30474-007/);
    assert.match(message, /1\. Full Report shows the summary \(TC-100\) — AC 1\n   1\. Open \/Customer\/Request\n   2\. Click Full Report\n   Data: request 1190908\n   Expected: The summary section is shown/);
    assert.match(message, /2\. API returns 200 for XB \(agent\) \[blocked by Q-30474-007\] — AC 3/);
    assert.match(message, /Services: pvs-web \(owns the screen\); pvs-api \(called by the portal\)/);
    assert.match(message, /Results so far \(1 pass, 0 fail, 1 blocked, 1 not_run\):\n- pass: Full Report shows the summary\n- blocked: API returns 200 for XB: No XB data; waits for Q-30474-007\n- not_run: Export works: Time ran out/);
    assert.match(message, /Next: Q-30474-007 brings the XB data\.\n<\/previous-report>/);
    assert.match(message, /<\/previous-report>\n\n<where-to-look>/);
  });

  it("says when nothing ran yet", () => {
    const message = composeTestMessage(task, 30474, pbiMessage, { id: "TR-30474-001", report: { ...report, results: [] } }, noRepos());

    assert.match(message, /Results so far: none, nothing ran yet\./);
  });
});

describe("renderTestReport with results carried over from an earlier report", () => {
  it("keeps the earlier verdicts, resolves the new ids and leaves existing ids as they are", () => {
    const carried: TestReport = {
      ...report,
      cases: [...report.cases, { ref: "agent", title: "Export rejects a locked request", criterion: "AC 5", steps: ["Click Export on a locked request"], data: "none", expected: "An error", state: "blocked", blockedBy: "new:1" }],
      results: [...report.results, { case: "Export rejects a locked request", criterion: "AC 5", verdict: "fail", observed: "Exported anyway", artifacts: [], bug: "bug:1" }],
    };

    const body = renderTestReport(carried, ["HT-30474-014"], ["BUG-30474-001"]);

    assert.match(body, /\| Full Report shows the summary \| pass \| Summary visible \|  \| trace\.zip \|/);
    assert.match(body, /\| API returns 200 for XB \| blocked \| No XB data; waits for Q-30474-007 \|  \|  \|/);
    assert.match(body, /blocked by HT-30474-014/);
    assert.match(body, /\| Export rejects a locked request \| fail \| Exported anyway \| BUG-30474-001 \|  \|/);
  });
});
