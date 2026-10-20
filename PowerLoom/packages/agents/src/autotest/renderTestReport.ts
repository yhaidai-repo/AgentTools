import type { PlannedCase } from "./models/PlannedCase";
import type { TestFinding } from "./models/TestFinding";
import type { TestReport } from "./models/TestReport";

// The report as the item page and the next run read it: findings and cases with their ids resolved.
export function renderTestReport(report: TestReport, taskIds: string[]): string {
  const resolve = (ref: string) => resolveNewId(ref, taskIds);

  return [
    `**Goal:** ${report.goal}`,
    `**Status:** ${report.status}`,
    report.summary,
    "## Analysis",
    report.analysis.length === 0 ? "No gaps: the criteria, test cases and test data match." : report.analysis.map((finding) => findingLine(finding, resolve)).join("\n"),
    "## Plan",
    report.cases.length === 0 ? "No case planned." : report.cases.map((planned, index) => caseBlock(planned, index + 1, resolve)).join("\n\n"),
    ...(report.services.length > 0 ? ["## Services", report.services.map((service) => `- ${service.name}: ${service.why}`).join("\n")] : []),
    `**Next:** ${report.nextReason}`,
  ].join("\n\n");
}

// `new:<n>` names the n-th task created in the run; after the commit it has an id.
export function resolveNewId(ref: string, taskIds: string[]): string {
  const match = /^new:(\d+)$/.exec(ref);

  if (!match) {
    return ref;
  }

  return taskIds[Number(match[1]) - 1] ?? ref;
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
