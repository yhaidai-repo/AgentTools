import type { CaseResult } from "./models/CaseResult";
import type { PlannedCase } from "./models/PlannedCase";
import type { PreviousReport } from "./models/PreviousReport";
import type { TestReport } from "./models/TestReport";

const VERDICTS: CaseResult["verdict"][] = ["pass", "fail", "blocked", "not_run"];

// The previous report as the next run continues from it: the plan to execute, the verdicts to keep and the cases
// still to run, each blocked one with the item that blocks it. Compact: the full report stays one read_pbi away.
export function previousReportBlock(previous: PreviousReport): string {
  const { id, report } = previous;

  return [
    "<previous-report>",
    `${id} (status ${report.status}), the latest report of this task. Execute its plan; don't analyse or plan again unless an answer above changed a finding. Verdicts in "Results so far" stay unless the branch under test changed; cite ${id} as their evidence (source S0). Write the whole report again, with the kept results and the new ones.`,
    `Summary: ${report.summary}`,
    ...findingsSection(report),
    "Plan:",
    report.cases.map((planned, index) => caseLines(planned, index + 1)).join("\n"),
    ...servicesSection(report),
    ...resultsSection(report),
    `Next: ${report.nextReason}`,
    "</previous-report>",
  ].join("\n");
}

function findingsSection(report: TestReport): string[] {
  if (report.analysis.length === 0) {
    return [];
  }

  return ["Findings and their resolutions (the items above say which are still open):", ...report.analysis.map((finding) => `- ${finding.kind.replaceAll("_", " ")} (${finding.about}): ${finding.detail} → ${finding.resolution}`)];
}

function caseLines(planned: PlannedCase, number: number): string {
  const state = planned.state === "blocked" ? ` [blocked by ${planned.blockedBy ?? "?"}]` : "";

  return [
    `${number}. ${planned.title} (${planned.ref})${state} — ${planned.criterion}`,
    ...planned.steps.map((step, index) => `   ${index + 1}. ${step}`),
    `   Data: ${planned.data || "none"}`,
    `   Expected: ${planned.expected}`,
  ].join("\n");
}

function servicesSection(report: TestReport): string[] {
  return report.services.length > 0 ? [`Services: ${report.services.map((service) => `${service.name} (${service.why})`).join("; ")}`] : [];
}

function resultsSection(report: TestReport): string[] {
  if (report.results.length === 0) {
    return ["Results so far: none, nothing ran yet."];
  }

  const counts = VERDICTS.map((verdict) => `${report.results.filter((result) => result.verdict === verdict).length} ${verdict}`).join(", ");

  return [`Results so far (${counts}):`, ...VERDICTS.flatMap((verdict) => verdictLines(report.results, verdict))];
}

function verdictLines(results: CaseResult[], verdict: CaseResult["verdict"]): string[] {
  const matching = results.filter((result) => result.verdict === verdict);

  if (matching.length === 0) {
    return [];
  }

  return [`- ${verdict}: ${matching.map((result) => resultText(result)).join("; ")}`];
}

// A passed case is named only; a case still to run says why it didn't, with the item or bug behind it.
function resultText(result: CaseResult): string {
  const bug = result.bug ? ` (${result.bug})` : "";

  return result.verdict === "pass" ? result.case : `${result.case}${bug}: ${result.observed}`;
}
