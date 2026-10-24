import type { CaseResult } from "./models/CaseResult";
import type { TestReport } from "./models/TestReport";

// A PBI bug's ref, as the first message names it (PBI-<ado id>).
const BUG_REF = /^PBI-\d+$/;

const OUTCOMES: Record<CaseResult["verdict"], string> = {
  pass: "fixed",
  fail: "still failing",
  blocked: "not retested (blocked)",
  not_run: "not retested (not run)",
};

// What the run's retests say about the PBI's bugs: a result names the bug it retests (its `bug` field), or its case
// is a retest case (ref PBI-<id>). One line per bug; the last result for a bug wins.
export function bugRetestLines(report: TestReport): string[] {
  const outcomes = new Map(report.results.flatMap((result) => bugOutcome(report, result)));

  return [...outcomes].map(([bug, outcome]) => `- ${bug}: ${outcome}`);
}

function bugOutcome(report: TestReport, result: CaseResult): [string, string][] {
  const bug = retestedBug(report, result);

  return bug ? [[bug, `${OUTCOMES[result.verdict]} (case "${result.case}")`]] : [];
}

function retestedBug(report: TestReport, result: CaseResult): string | null {
  if (result.bug && BUG_REF.test(result.bug)) {
    return result.bug;
  }

  const ref = report.cases.find((planned) => planned.title === result.case)?.ref ?? "";

  return BUG_REF.test(ref) ? ref : null;
}
