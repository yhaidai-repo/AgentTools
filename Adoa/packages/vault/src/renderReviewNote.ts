import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { ReviewNote } from "./models/ReviewNote";
import type { ReviewNoteComment } from "./models/ReviewNoteComment";
import { pbiNoteName, reviewNoteName } from "./paths";

// The chat's first answer (user decision 2026-10-05): a briefing, then one question; review only, the chat never fixes code.
// Four backticks, so a snippet that holds a fence of its own doesn't end the block.
const CODE_FENCE = "````";

const BRIEFING = [
  "**What the PR does**: in short, in 2–3 sentences.",
  "**Risky spots**: with `file:line`.",
  "**Each open comment**: still valid? why, with `file:line`.",
  "**Missed by the review**: problems no comment names.",
];

export function renderReviewNote(note: ReviewNote, notesSection: string): string {
  return [
    frontmatter({
      id: reviewNoteName(note.prId),
      type: "review",
      title: `PR ${note.prId}: ${note.title}`,
      status: "final",
      repo: note.repoName,
      created_by: "adoa",
      updated: isoDate(note.updated),
      tags: ["adoa", "review", `pr-${note.prId}`],
      related: note.linkedPbis.map((adoId) => `[[${pbiNoteName(adoId)}]]`),
    }),
    `# ${reviewNoteName(note.prId)} ${note.title}`,
    `[Open in Azure DevOps](${note.url}) · ${note.repoName} · \`${note.sourceBranch}\` → \`${note.targetBranch}\` · by ${note.author ?? "–"}`,
    `Latest commit \`${note.sourceCommit}\`; reviewed commit \`${note.reviewedCommit ?? "none"}\`. PBIs: ${note.linkedPbis.map((adoId) => `[[${pbiNoteName(adoId)}]]`).join(", ") || "none"}.`,
    "Handoff for the Claude chat that continues this review (adoa's \"Continue with Claude\").",
    "## Start",
    startSteps(note),
    "## Summary",
    note.summaryMd ?? "Not reviewed yet.",
    "## Comments",
    note.comments.length > 0 ? note.comments.map(renderComment).join("\n\n") : "None.",
    notesSection,
  ].join("\n\n");
}

function startSteps(note: ReviewNote): string {
  return [
    `1. Read the PR in the ${note.repoName} repo without changing it: \`git fetch origin\`, then \`git diff origin/${note.targetBranch}...origin/${note.sourceBranch}\`. No checkout, no file changes: review only.`,
    "2. Read the summary and comments below, and the code around them.",
    "3. Answer with a briefing for the user, in plain language, short, in this order:",
    ...BRIEFING.map((part, index) => `   ${index + 1}. ${part}`),
    "4. End the briefing by asking: \"Write the answers?\" After a yes: one answer per open comment, by its id, as plain text to paste into adoa's review page.",
  ].join("\n");
}

function renderComment(comment: ReviewNoteComment): string {
  return [
    `### ${comment.id} · ${comment.severity} · ${comment.status}`,
    `\`${comment.filePath}:${comment.startLine}-${comment.endLine}\``,
    comment.bodyMd,
    `Code (from line ${comment.snippetStartLine}):\n\n${CODE_FENCE}\n${comment.codeSnippet}\n${CODE_FENCE}`,
    ...(comment.answerMd ? [`**Answer:** ${comment.answerMd}`] : []),
    ...(comment.agentReplyMd ? [`**Agent reply:** ${comment.agentReplyMd}`] : []),
  ].join("\n\n");
}
