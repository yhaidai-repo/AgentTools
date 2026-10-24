import type { AdoPrChange, AdoPrComment, AdoPrThread, AdoPullRequest, AdoPullRequestDetails, AdoReviewerVote } from "@powerloom/ado";

// ADO's vote values (AdoReviewerVote).
const VOTES = new Map<number, string>([
  [10, "approved"],
  [5, "approved with suggestions"],
  [0, "no vote"],
  [-5, "waiting for the author"],
  [-10, "rejected"],
]);

// A PR's file list is cut here: a merge between long-lived branches can change thousands of files.
const MAX_FILES = 300;

export function pullRequestListText(pullRequests: AdoPullRequest[]): string {
  if (pullRequests.length === 0) {
    return "No pull requests match.";
  }

  return pullRequests.map(pullRequestLine).join("\n");
}

export function pullRequestMarkdown(pullRequest: AdoPullRequest, details: AdoPullRequestDetails, changes: AdoPrChange[] | null): string {
  const sections = [
    `# PR ${pullRequest.id}: ${pullRequest.title}`,
    summaryLines(pullRequest, details).join("\n"),
    ["## Reviewers", ...votesLines(pullRequest.votes)].join("\n"),
    `## Description\n\n${pullRequest.description?.trim() || "(none)"}`,
    changes === null ? "" : changesSection(changes),
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function threadsMarkdown(pullRequest: AdoPullRequest, threads: AdoPrThread[]): string {
  const heading = `# Comment threads of PR ${pullRequest.id}: ${pullRequest.title} (${threads.length})`;

  if (threads.length === 0) {
    return `${heading}\n\nNo comments.`;
  }

  return [heading, ...threads.map(threadText)].join("\n\n");
}

// ADO's own comments (votes, pushes, status changes); a thread left with none of a person's comments is dropped.
export function withoutSystemComments(threads: AdoPrThread[]): AdoPrThread[] {
  const cleaned = threads.map((thread) => ({ ...thread, comments: thread.comments.filter((comment) => comment.type !== "system") }));

  return cleaned.filter((thread) => thread.comments.length > 0);
}

function pullRequestLine(pullRequest: AdoPullRequest): string {
  const closed = pullRequest.closedAt ? `, closed ${day(pullRequest.closedAt)}` : "";

  return `- PR ${pullRequest.id} [${statusOf(pullRequest)}] ${pullRequest.repoName}: ${pullRequest.title} – ${branchesOf(pullRequest)}, by ${pullRequest.author ?? "unknown"}, created ${day(pullRequest.createdAt)}${closed}`;
}

function summaryLines(pullRequest: AdoPullRequest, details: AdoPullRequestDetails): string[] {
  const closed = pullRequest.closedAt ? `, closed ${pullRequest.closedAt}` : "";
  const workItems = details.workItemIds.length > 0 ? `${details.workItemIds.join(", ")} (read_work_item)` : "none";

  return [
    `- Repository: ${pullRequest.repoName}`,
    `- Status: ${statusOf(pullRequest)}`,
    `- Branches: ${branchesOf(pullRequest)}`,
    `- Author: ${pullRequest.author ?? "unknown"}`,
    `- Created: ${pullRequest.createdAt ?? "unknown"}${closed}`,
    `- Merge commit: ${pullRequest.mergeCommit ?? "none (not completed)"}`,
    `- Last source commit: ${pullRequest.sourceCommit ?? "unknown"}`,
    `- Pushes (iterations): ${details.iteration}`,
    `- Linked work items: ${workItems}`,
    `- Link: ${pullRequest.url}`,
  ];
}

function votesLines(votes: AdoReviewerVote[]): string[] {
  if (votes.length === 0) {
    return ["None."];
  }

  return votes.map((vote) => `- ${vote.name}${vote.isRequired ? " (required)" : ""}: ${VOTES.get(vote.vote) ?? `vote ${vote.vote}`}`);
}

function changesSection(changes: AdoPrChange[]): string {
  const lines = changes.slice(0, MAX_FILES).map(changeLine);
  const more = changes.length > MAX_FILES ? [`- … and ${changes.length - MAX_FILES} more`] : [];

  return [`## Changed files (${changes.length})`, ...lines, ...more].join("\n");
}

function changeLine(change: AdoPrChange): string {
  const from = change.originalPath ? ` (from ${change.originalPath})` : "";

  return `- ${change.changeType} ${change.path}${from}`;
}

function threadText(thread: AdoPrThread): string {
  const comments = thread.comments.filter((comment) => !comment.isDeleted);

  return [`## Thread ${thread.id} [${thread.status}] on ${placeOf(thread)}`, ...comments.map(commentText)].join("\n");
}

function placeOf(thread: AdoPrThread): string {
  if (!thread.filePath) {
    return "the PR";
  }

  if (thread.startLine === null) {
    return thread.filePath;
  }

  const end = thread.endLine !== null && thread.endLine !== thread.startLine ? `-${thread.endLine}` : "";

  return `${thread.filePath}:${thread.startLine}${end}`;
}

// A reply is indented under the thread's first comment; a multi-line comment keeps its lines under its bullet.
function commentText(comment: AdoPrComment): string {
  const indent = comment.parentId === 0 ? "" : "  ";
  const kind = comment.type === "text" ? "" : `, ${comment.type}`;
  const body = comment.content.trim().replaceAll("\n", `\n${indent}  `);

  return `${indent}- ${comment.author ?? "unknown"} (${day(comment.createdAt)}${kind}): ${body}`;
}

function statusOf(pullRequest: AdoPullRequest): string {
  return pullRequest.isDraft ? `${pullRequest.status}, draft` : pullRequest.status;
}

function branchesOf(pullRequest: AdoPullRequest): string {
  return `${branchName(pullRequest.sourceRef)} → ${branchName(pullRequest.targetRef)}`;
}

function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

function day(iso: string | null): string {
  return iso?.slice(0, 10) ?? "unknown";
}
