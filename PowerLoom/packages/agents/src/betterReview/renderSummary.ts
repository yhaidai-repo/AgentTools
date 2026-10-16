import type { BetterReviewSummary } from "./models/BetterReviewSummary";
import type { CriterionCheck } from "./models/CriterionCheck";
import type { ReviewerNote } from "./models/ReviewerNote";

const VERDICTS: Record<BetterReviewSummary["verdict"], string> = { ready: "Ready to merge", ready_with_fixes: "Ready with fixes", not_ready: "Not ready" };
const CRITERION_MARKS: Record<CriterionCheck["status"], string> = { met: "✓ met", partly: "◐ partly", not_met: "✗ not met", not_verifiable: "? not verifiable", out_of_scope: "– out of scope" };

// The review's summary as markdown (code_review.summary_md): what the review page, the Continue chat and the next run
// read; the structured result goes to code_review.details.
export function renderSummary(result: BetterReviewSummary, notes: ReviewerNote[]): string {
  return [
    `**${VERDICTS[result.verdict]}.** ${result.assessment}`,
    result.goals.length > 0 ? ["**Goals**", ...result.goals.map((goal) => `- ${goal.pbi}: ${goal.goal}`)].join("\n") : "**Goals**: the PR links no PBI.",
    result.criteria.length > 0 ? ["**Acceptance criteria**", "| PBI | Criterion | Status | Note |", "|---|---|---|---|", ...result.criteria.map(criterionRow)].join("\n") : "",
    `**Business logic**: ${result.businessLogic}`,
    result.risks.length > 0 ? ["**Risks**", ...result.risks.map((risk) => `- ${risk}`)].join("\n") : "",
    notes.length > 0 ? ["**Other reviewers**", ...notes.map(noteLine)].join("\n") : "",
    result.notReviewed.length > 0 ? ["**Not reviewed**", ...result.notReviewed.map((item) => `- ${item.what}: ${item.why}`)].join("\n") : "",
  ].filter(Boolean).join("\n\n");
}

function criterionRow(item: CriterionCheck): string {
  return `| ${cell(item.pbi)} | ${cell(item.criterion)} | ${CRITERION_MARKS[item.status]} | ${cell(item.note)} |`;
}

function noteLine(note: ReviewerNote): string {
  const covered = note.coveredBy ? ` by ${note.coveredBy}` : "";

  return `- Thread ${note.threadId}: ${note.verdict.replace("_", " ")}${covered}. ${note.note}`;
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll(/\s*\n\s*/g, " ");
}
