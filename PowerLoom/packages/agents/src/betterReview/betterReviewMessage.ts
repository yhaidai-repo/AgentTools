import type { AdoPrThread } from "@powerloom/ado";
import type { reviewComment } from "@powerloom/db";
import type { PullRequestCheckout } from "@agenttools/runtime";
import type { DiffScope } from "../codeReview/models/DiffScope";
import type { LinkedPbi } from "../codeReview/models/LinkedPbi";
import type { BetterReviewContext } from "./models/BetterReviewContext";
import type { ReviewMode } from "./models/ReviewMode";

type CommentRow = typeof reviewComment.$inferSelect;

const MAX_SUMMARY_CHARS = 3000;
const MAX_THREAD_CHARS = 1500;

// The first message (source S0): the PR, the mode with its anchor, each linked PBI in full, the repo's review rules,
// earlier comments with the user's answers, the other reviewers' threads and the research asked for earlier.
export function buildBetterReviewMessage(context: BetterReviewContext, checkout: PullRequestCheckout, scope: DiffScope, mode: ReviewMode, outdatedIds: string[]): string {
  const { pr } = context;

  return [
    mode.kind === "full" ? "Review this pull request." : "Follow up your review of this pull request: check the fixes and what changed since.",
    [
      "<pull-request>",
      `Id: ${pr.id}`,
      `Title: ${pr.title}`,
      `Repo: ${context.repo.name} (code tools: paths start with "${context.repo.name}/"; the checkout is the PR's commit)`,
      `Author: ${pr.author ?? "-"}`,
      `Branches: ${pr.sourceRef} → ${pr.targetRef}`,
      `Commits: changes from ${checkout.mergeBase} (merge base) to ${checkout.sourceCommit}`,
      "</pull-request>",
    ].join("\n"),
    `<description>\n${pr.descriptionMd?.trim() || "(none)"}\n</description>`,
    modeBlock(context, scope, mode),
    pbisBlock(context),
    rulesBlock(context),
    `<earlier-comments>\n${context.earlierComments.map((comment) => commentBlock(comment, outdatedIds, mode)).join("\n\n") || "none: this is the first review"}\n</earlier-comments>`,
    otherReviewsBlock(context),
    researchBlock(context),
  ].filter(Boolean).join("\n\n");
}

function modeBlock(context: BetterReviewContext, scope: DiffScope, mode: ReviewMode): string {
  const counts = `${scope.reviewed.length} to review, ${scope.skipped.length} not in this review; get_pr_diff lists them.`;

  if (mode.kind === "full") {
    return `<review-mode>\nFull review (${mode.reason}). ${counts}\n</review-mode>`;
  }

  const previous = context.previous?.summaryMd ? `\nThe last review's summary:\n${clip(context.previous.summaryMd, MAX_SUMMARY_CHARS)}` : "";

  return [
    "<review-mode>",
    `Follow-up, anchored to ${mode.baseCommit} (the commit the last review saw). get_pr_diff shows what changed since then; get_pr_diff(path, full: true) the file's whole PR diff. ${counts}`,
    "Check every earlier comment first: fixed, still open (keep, and move it to its lines now), or withdrawn. Review only the changed code for new issues; the rest was reviewed already.",
    previous,
    "</review-mode>",
  ].filter(Boolean).join("\n");
}

function pbisBlock(context: BetterReviewContext): string {
  const full = new Map(context.pbiTexts.map((pbi) => [pbi.adoId, pbi.text]));
  const blocks = context.linkedPbis.map((pbi) => full.get(pbi.adoId) ? `<pbi id="PBI-${pbi.adoId}">\n${full.get(pbi.adoId)}\n</pbi>` : summaryBlock(pbi));

  return `<linked-pbis>\nWhat the change must do: take the goals and the acceptance criteria from these. read_pbi(PBI-<id>) reads one in full, or a reference it lists.\n${blocks.join("\n\n") || "none: the PR links no work item; say so in the summary"}\n</linked-pbis>`;
}

function summaryBlock(pbi: LinkedPbi): string {
  if (pbi.title === null) {
    return `PBI-${pbi.adoId} (not in PowerLoom: read it with read_work_item when Azure DevOps is listed)`;
  }

  return [`PBI-${pbi.adoId}: ${pbi.title} (summary; read_pbi for the rest)`, pbi.parent ? `Child item of PBI-${pbi.parent.adoId}: ${pbi.parent.title}` : "", `Refinement: ${pbi.refinementSummary ?? "not refined yet"}`].filter(Boolean).join("\n");
}

function rulesBlock(context: BetterReviewContext): string {
  const active = context.rules.rules.filter((rule) => rule.active);
  const where = `the vault's ${context.rules.path}`;

  if (active.length === 0) {
    return `<review-rules>\nNone yet for ${context.repo.name} (${where}).\n</review-rules>`;
  }

  return `<review-rules>\nThe team's rules for reviews of ${context.repo.name} (${where}): follow them; never raise what a decision settled.\n\n${active.map((rule) => rule.text).join("\n\n")}\n</review-rules>`;
}

function commentBlock(comment: CommentRow, outdatedIds: string[], mode: ReviewMode): string {
  const changed = outdatedIds.includes(comment.id);
  const status = changed ? (mode.kind === "follow-up" ? `${comment.status}, its code changed since: check whether it's fixed` : "outdated (its code changed; leave it)") : comment.status;
  const lines = [
    `${comment.id} [${status}, ${comment.severity}${comment.category ? `, ${comment.category}` : ""}] ${comment.filePath}:${comment.startLine}-${comment.endLine} (commit ${comment.commit.slice(0, 8)})`,
    `Comment: ${comment.bodyMd}`,
    comment.answerMd ? `User's answer: ${comment.answerMd}` : "",
    comment.agentReplyMd ? `Your earlier reply: ${comment.agentReplyMd}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function otherReviewsBlock(context: BetterReviewContext): string {
  if ("unavailable" in context.otherReviews) {
    return `<other-reviewers>\nNot available: ${context.otherReviews.unavailable}. Say so in the summary.\n</other-reviewers>`;
  }

  const threads = context.otherReviews.threads;

  if (threads.length === 0) {
    return "<other-reviewers>\nNo comments from people on the PR in Azure DevOps.\n</other-reviewers>";
  }

  return `<other-reviewers>\nThe PR's comment threads in Azure DevOps (people only). Weigh each with assess_reviewer_comment: a point your review missed is a lesson for the repo's rules.\n\n${threads.map(threadBlock).join("\n\n")}\n</other-reviewers>`;
}

function threadBlock(thread: AdoPrThread): string {
  const place = thread.filePath ? `${thread.filePath}${thread.startLine !== null ? `:${thread.startLine}${thread.endLine !== null && thread.endLine !== thread.startLine ? `-${thread.endLine}` : ""}` : ""}` : "the PR";
  const comments = thread.comments.filter((comment) => !comment.isDeleted).map((comment) => `${comment.parentId === 0 ? "-" : "  -"} ${comment.author ?? "unknown"}: ${clip(comment.content.trim(), MAX_THREAD_CHARS).replaceAll("\n", "\n    ")}`);

  return [`Thread ${thread.id} [${thread.status}] on ${place}`, ...comments].join("\n");
}

function researchBlock(context: BetterReviewContext): string {
  if (context.research.length === 0) {
    return "";
  }

  const lines = context.research.map((item) => item.conclusion ? `${item.taskId} [${item.status}] ${item.title}\nResult ${item.resultId}: ${item.conclusion}` : `${item.taskId} [${item.status}] ${item.title}: no result yet`);

  return `<research>\nResearch earlier runs of this review asked for; use the answers, don't ask again.\n\n${lines.join("\n\n")}\n</research>`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
