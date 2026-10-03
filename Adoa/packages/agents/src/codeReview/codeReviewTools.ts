import { readFile } from "node:fs/promises";
import { reviewSeverity, type reviewComment } from "@adoa/db";
import { defineTool, resolveInside, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { DiffFile } from "./models/DiffFile";
import type { ReviewRun } from "./models/ReviewRun";
import { overlaps } from "./prDiff";

type CommentRow = typeof reviewComment.$inferSelect;

const SNIPPET_CONTEXT = 3;
const MAX_COMMENT_LINES = 40;

// The code-review agent's own tools. They only fill the run's draft; nothing is written until the run succeeds.
export function createCodeReviewTools(run: ReviewRun): ToolDefinition<any>[] {
  return [diffTool(run), addCommentTool(run), updateCommentTool(run), summaryTool(run)];
}

function diffTool(run: ReviewRun) {
  return defineTool({
    name: "get_pr_diff",
    description: "Without a path: the PR's changed files (+added −removed) and which of them this review covers. With a path: that file's diff (hunks, 3 lines of context, new-side line numbers after '+').",
    input: { path: z.string().default("").describe("A changed file's path as listed, or '' for the list") },
    handler: async ({ path }) => {
      if (!path) {
        return { text: fileList(run) };
      }

      const file = changedFile(run, path);

      return file ? { text: file.patch } : { text: `${path} isn't a changed file of this PR; call get_pr_diff without a path for the list.`, isError: true };
    },
  });
}

function addCommentTool(run: ReviewRun) {
  return defineTool({
    name: "add_review_comment",
    description: `Add one review comment on lines of a changed file in the PR's commit (new-side line numbers, at most ${MAX_COMMENT_LINES} lines). One issue per comment.`,
    input: {
      path: z.string().describe("The changed file, as get_pr_diff lists it"),
      start_line: z.number().int().min(1),
      end_line: z.number().int().min(1),
      severity: z.enum(reviewSeverity.enumValues).describe("blocker: must be fixed before merge; major: a real bug or risk; minor: worth fixing; nit: optional polish"),
      body: z.string().min(1).describe("The problem, why it matters, and what to do instead"),
    },
    handler: async (input) => {
      const problem = await commentProblem(run, input.path, input.start_line, input.end_line);

      if (problem) {
        return { text: problem, isError: true };
      }

      const snippet = await readSnippet(run, input.path, input.start_line, input.end_line);

      run.draft.comments.push({ path: input.path, startLine: input.start_line, endLine: input.end_line, severity: input.severity, body: input.body, ...snippet });

      return { text: `Comment ${run.draft.comments.length} noted on ${input.path}:${input.start_line}-${input.end_line}.` };
    },
  });
}

function updateCommentTool(run: ReviewRun) {
  return defineTool({
    name: "update_comment",
    description: "Decide about an earlier comment (especially one the user answered): withdraw it, keep it, or refine its text. The reply is shown under the user's answer.",
    input: {
      id: z.string().describe("The earlier comment's id, e.g. RC-6322-003"),
      action: z.enum(["withdraw", "keep", "refine"]),
      reply: z.string().min(1).describe("Your answer to the user's reply, or why you withdraw / keep / refine it"),
      body: z.string().optional().describe("The new comment text (refine only)"),
    },
    handler: async (input) => {
      const earlier = run.context?.earlierComments.find((comment) => comment.id === input.id);

      if (!earlier || run.outdatedIds.includes(input.id)) {
        return { text: `${input.id} isn't an open earlier comment of this review.`, isError: true };
      }

      if (input.action === "refine" && !input.body) {
        return { text: "refine needs the new comment text in body.", isError: true };
      }

      run.draft.updates = [...run.draft.updates.filter((update) => update.id !== input.id), { id: input.id, action: input.action, reply: input.reply, body: input.body ?? null }];

      return { text: `${input.id}: ${input.action} noted.` };
    },
  });
}

function summaryTool(run: ReviewRun) {
  return defineTool({
    name: "write_review_summary",
    description: "Save the review's summary: overall assessment, the main risks, what you didn't review and why. Call once at the end; a second call replaces the first.",
    input: { summary: z.string().min(1) },
    handler: async ({ summary }) => {
      run.draft.summary = summary;

      return { text: "Summary saved." };
    },
  });
}

function fileList(run: ReviewRun): string {
  const reviewed = run.scope.reviewed.map((file) => `- ${describe(file)}`);
  const skipped = run.scope.skipped.map(({ file, reason }) => `- ${describe(file)}: ${reason}`);

  return [`Review these (${reviewed.length}):`, ...reviewed, "", `Not in this review (${skipped.length}):`, ...skipped].join("\n");
}

function describe(file: DiffFile): string {
  const renamed = file.oldPath ? ` (renamed from ${file.oldPath})` : "";

  return `${file.path}${renamed} [${file.status}] +${file.added} −${file.removed}`;
}

function changedFile(run: ReviewRun, path: string): DiffFile | undefined {
  return [...run.scope.reviewed, ...run.scope.skipped.map((entry) => entry.file)].find((file) => file.path === path);
}

async function commentProblem(run: ReviewRun, path: string, startLine: number, endLine: number): Promise<string | null> {
  const file = changedFile(run, path);

  if (!file || file.status === "deleted" || file.status === "binary") {
    return `${path} isn't a changed text file in the PR's commit; comment on a file get_pr_diff lists.`;
  }

  if (endLine < startLine || endLine - startLine >= MAX_COMMENT_LINES) {
    return `Lines ${startLine}-${endLine}: end must be ≥ start and the range at most ${MAX_COMMENT_LINES} lines.`;
  }

  const lineCount = (await readLines(run, path)).length;

  if (endLine > lineCount) {
    return `${path} has ${lineCount} lines in the PR's commit.`;
  }

  return duplicateOf(run, path, startLine, endLine);
}

// One comment per issue: an earlier comment still standing, or one added this run, on the same lines.
function duplicateOf(run: ReviewRun, path: string, startLine: number, endLine: number): string | null {
  const earlier = (run.context?.earlierComments ?? []).filter((comment) => isStanding(run, comment) && comment.filePath === path && overlaps([[comment.startLine, comment.endLine]], startLine, endLine));
  const added = run.draft.comments.findIndex((comment) => comment.path === path && overlaps([[comment.startLine, comment.endLine]], startLine, endLine));

  if (earlier.length > 0) {
    return `${earlier.map((comment) => comment.id).join(", ")} already covers these lines: use update_comment (refine) instead, or comment on other lines.`;
  }

  return added >= 0 ? `Comment ${added + 1} of this run already covers these lines; one comment per issue.` : null;
}

function isStanding(run: ReviewRun, comment: CommentRow): boolean {
  return !run.outdatedIds.includes(comment.id) && run.draft.updates.every((update) => update.id !== comment.id || update.action !== "withdraw");
}

async function readSnippet(run: ReviewRun, path: string, startLine: number, endLine: number): Promise<{ snippet: string; snippetStartLine: number }> {
  const lines = await readLines(run, path);
  const from = Math.max(1, startLine - SNIPPET_CONTEXT);
  const to = Math.min(lines.length, endLine + SNIPPET_CONTEXT);

  return { snippet: lines.slice(from - 1, to).join("\n"), snippetStartLine: from };
}

async function readLines(run: ReviewRun, path: string): Promise<string[]> {
  const text = await readFile(resolveInside(run.checkout!.path, path), "utf8");

  return text.split(/\r?\n/);
}
