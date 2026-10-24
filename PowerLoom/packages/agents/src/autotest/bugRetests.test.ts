import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { noRepos } from "../repos/openRepos";
import type { ChildBug } from "./models/ChildBug";
import type { TestReport } from "./models/TestReport";
import { childBugsBlock } from "./renderChildBugs";
import { renderTestReport } from "./renderTestReport";
import { composeTestMessage } from "./testMessage";

type ItemRow = typeof localItem.$inferSelect;

const task = { id: "TT-26272-001", title: "Test PBI 26272", body: null, data: { goal: "Prove the criteria" } } as unknown as ItemRow;

const bugs: ChildBug[] = [
  { adoId: 31001, title: "[BUG] Trial badge missing on the facility card", adoState: "Done", steps: "1. Open facility 2684\n2. Look at the card\nExpected: Free trial badge" },
  { adoId: 31002, title: "[BUG] Invoice counts trial lookups", adoState: "To Do", steps: null },
];

const report: TestReport = {
  goal: "Prove the trial criteria",
  status: "complete",
  summary: "Both bugs retested.",
  analysis: [],
  cases: [
    { ref: "PBI-31001", title: "Retest trial badge", criterion: "AC 3", steps: ["Open facility 2684"], data: "facility 2684", expected: "Free trial badge shown", state: "planned", blockedBy: null },
    { ref: "TC-200", title: "Invoice excludes trial", criterion: "AC 8", steps: ["Open the invoice"], data: "none", expected: "No trial lookups billed", state: "planned", blockedBy: null },
  ],
  services: [],
  results: [
    { case: "Retest trial badge", criterion: "AC 3", verdict: "pass", observed: "Badge shown", artifacts: [], bug: null },
    { case: "Invoice excludes trial", criterion: "AC 8", verdict: "fail", observed: "Trial lookup billed", artifacts: [], bug: "PBI-31002" },
  ],
  adoEdits: [],
  nextReason: "PBI-31002 needs a fix.",
};

describe("the bugs to retest", () => {
  it("lists each bug with its state and steps on one line, and says when a bug has none", () => {
    const block = childBugsBlock(bugs);

    assert.match(block, /^<bugs-to-retest>\n/);
    assert.match(block, /- PBI-31001 \(Done\): \[BUG\] Trial badge missing on the facility card\n  Steps: 1\. Open facility 2684 \/ 2\. Look at the card \/ Expected: Free trial badge/);
    assert.match(block, /- PBI-31002 \(To Do\): \[BUG\] Invoice counts trial lookups\n  Steps: none written/);
  });

  it("cuts long steps and points to read_pbi", () => {
    const block = childBugsBlock([{ ...bugs[0], steps: "x".repeat(2000) }]);

    assert.match(block, /x{1500} … \[cut, read_pbi for the rest\]/);
  });

  it("are in the first message after the PBI, and absent when the PBI has none", () => {
    const withBugs = composeTestMessage(task, 26272, "<pbi>PBI-26272</pbi>", null, noRepos(), false, bugs);
    const without = composeTestMessage(task, 26272, "<pbi>PBI-26272</pbi>", null, noRepos());

    assert.match(withBugs, /<\/pbi>\n\n<bugs-to-retest>[\s\S]*<\/bugs-to-retest>\n\n<where-to-look>/);
    assert.doesNotMatch(without, /<bugs-to-retest>/);
  });
});

describe("the report's bugs retested section", () => {
  it("says fixed for a passed retest case and still failing for a failed case that names the bug", () => {
    const body = renderTestReport(report, []);

    assert.match(body, /## Bugs retested\n\n- PBI-31001: fixed \(case "Retest trial badge"\)\n- PBI-31002: still failing \(case "Invoice excludes trial"\)/);
  });

  it("is left out when no result retests a bug", () => {
    const body = renderTestReport({ ...report, cases: [report.cases[1]], results: [{ ...report.results[1], bug: "bug:1" }] }, [], ["31050"]);

    assert.doesNotMatch(body, /## Bugs retested/);
  });
});
