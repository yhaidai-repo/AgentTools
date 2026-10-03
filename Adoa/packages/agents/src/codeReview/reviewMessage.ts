import type { reviewComment } from "@adoa/db";
import type { PullRequestCheckout } from "@agenttools/runtime";
import type { LinkedPbi } from "./models/LinkedPbi";
import type { ReviewContext } from "./models/ReviewContext";
import type { DiffScope } from "./models/DiffScope";

type CommentRow = typeof reviewComment.$inferSelect;

const MAX_PBI_TEXT = 2000;

// The first message: the PR, the PBIs it links (what refinement and design said), the files in scope, and every earlier
// comment with the user's answer (user decision 2026-10-02: answers feed the next run).
export function buildReviewMessage(context: ReviewContext, checkout: PullRequestCheckout, scope: DiffScope, outdatedIds: string[]): string {
  const { pr } = context;

  return [
    "Review this pull request.",
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
    `<linked-pbis>\n${context.linkedPbis.map(pbiBlock).join("\n\n") || "none"}\n</linked-pbis>`,
    `<changed-files>\n${scope.reviewed.length} to review, ${scope.skipped.length} not in this review; get_pr_diff lists them.\n</changed-files>`,
    `<earlier-comments>\n${context.earlierComments.map((comment) => commentBlock(comment, outdatedIds)).join("\n\n") || "none: this is the first review"}\n</earlier-comments>`,
  ].join("\n\n");
}

function pbiBlock(pbi: LinkedPbi): string {
  if (pbi.title === null) {
    return `PBI-${pbi.adoId} (not in adoa)`;
  }

  return [
    `PBI-${pbi.adoId}: ${pbi.title}`,
    `Refinement: ${clip(pbi.refinementSummary) ?? "not refined yet"}`,
    `Design approach: ${clip(pbi.designApproach) ?? "no design yet"}`,
  ].join("\n");
}

function commentBlock(comment: CommentRow, outdatedIds: string[]): string {
  const status = outdatedIds.includes(comment.id) ? "outdated (its code changed; leave it)" : comment.status;
  const lines = [
    `${comment.id} [${status}, ${comment.severity}] ${comment.filePath}:${comment.startLine}-${comment.endLine} (commit ${comment.commit.slice(0, 8)})`,
    `Comment: ${comment.bodyMd}`,
    comment.answerMd ? `User's answer: ${comment.answerMd}` : "",
    comment.agentReplyMd ? `Your earlier reply: ${comment.agentReplyMd}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function clip(text: string | null): string | null {
  return text && text.length > MAX_PBI_TEXT ? `${text.slice(0, MAX_PBI_TEXT)}…` : text;
}
