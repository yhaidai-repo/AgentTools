import type { CaseResult } from "./models/CaseResult";
import type { PlannedCase } from "./models/PlannedCase";
import type { TestFinding } from "./models/TestFinding";
import type { TestReport } from "./models/TestReport";

// The report as the item page and the next run read it: findings and cases with their ids resolved. The agent names
// tasks it created as new:<n> anywhere (a blocked_by list, a step's data), so the whole text is resolved at the end.
export function renderTestReport(report: TestReport, taskIds: string[], bugIds: string[] = []): string {
  return resolveNewIds(renderUnresolved(report), taskIds, bugIds);
}

function renderUnresolved(report: TestReport): string {
  const resolve = (ref: string) => ref;

  return [
    `**Goal:** ${report.goal}`,
    `**Status:** ${report.status}`,
    report.summary,
    "## Analysis",
    report.analysis.length === 0 ? "No gaps: the criteria, test cases and test data match." : report.analysis.map((finding) => findingLine(finding, resolve)).join("\n"),
    "## Plan",
    report.cases.length === 0 ? "No case planned." : report.cases.map((planned, index) => caseBlock(planned, index + 1, resolve)).join("\n\n"),
    ...(report.services.length > 0 ? ["## Services", report.services.map((service) => `- ${service.name}: ${service.why}`).join("\n")] : []),
    ...(report.results.length > 0 ? ["## Results", resultsTable(report.results)] : []),
    ...(report.adoEdits.length > 0 ? ["## ADO test cases to update", report.adoEdits.map((line) => `- ${line}`).join("\n")] : []),
    `**Next:** ${report.nextReason}`,
  ].join("\n\n");
}

// `new:<n>` names the n-th task and `bug:<n>` the n-th bug created in the run; after the commit they have ids.
// Unknown numbers stay as written.
export function resolveNewIds(text: string, taskIds: string[], bugIds: string[] = []): string {
  return text
    .replace(/\bnew:(\d+)\b/g, (whole, number: string) => taskIds[Number(number) - 1] ?? whole)
    .replace(/\bbug:(\d+)\b/g, (whole, number: string) => bugIds[Number(number) - 1] ?? whole);
}

function resultsTable(results: CaseResult[]): string {
  const rows = results.map((result) => `| ${result.case} | ${result.verdict} | ${result.observed.replaceAll("|", "/")} | ${result.bug ?? ""} | ${result.artifacts.map((path) => path.split("/").pop()).join(", ")} |`);

  return ["| Case | Verdict | Observed | Bug | Recording |", "|---|---|---|---|---|", ...rows].join("\n");
}

function findingLine(finding: TestFinding, resolve: (ref: string) => string): string {
  return `- **${finding.kind.replaceAll("_", " ")}** (${finding.about}): ${finding.detail} → ${resolve(finding.resolution)}`;
}

function caseBlock(planned: PlannedCase, number: number, resolve: (ref: string) => string): string {
  const state = planned.state === "blocked" ? ` — blocked by ${resolve(planned.blockedBy ?? "?")}` : "";

  return [
    `### ${number}. ${planned.title} (${planned.ref})${state}`,
    `Criterion: ${planned.criterion}`,
    ...planned.steps.map((step, index) => `${index + 1}. ${step}`),
    `Data: ${planned.data || "none"}`,
    `Expected: ${planned.expected}`,
  ].join("\n");
}
