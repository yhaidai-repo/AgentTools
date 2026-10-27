import { textSimilarity } from "@powerloom/core";
import type { AdoPrThread } from "@powerloom/ado";
import { reviewSeverity, type reviewComment } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { changedFile, commentProblem, describe, readLines, readSnippet } from "../codeReview/codeReviewTools";
import type { CommentAnchor } from "../codeReview/models/CommentAnchor";
import { optionalEvidenceInput, resultStatusInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import { recordReads } from "../evidence/recordReads";
import type { ReadLog } from "../evidence/ReadLog";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import type { BetterReviewSummary } from "./models/BetterReviewSummary";
import type { ReviewerNote } from "./models/ReviewerNote";
import type { ReviewRuleDraft } from "./models/ReviewRuleDraft";
import { renderSummary } from "./renderSummary";
import { reviewerNotesWithCarried, weighedThreads } from "./threadsSeen";

type CommentRow = typeof reviewComment.$inferSelect;

const MAX_COMMENT_LINES = 40;
const MAX_QUOTE = 400;
// Rules are short instructions; a rule this close to one the repo has says the same thing again.
const SAME_RULE = 0.6;

export const SUMMARY_TOOL = "write_review_summary";

export const COMMENT_CATEGORIES = ["business-logic", "correctness", "style", "data", "performance", "security", "tests", "design"] as const;

const ruleInput = z.object({
  rule: z.string().min(1).describe("One line, as an instruction to every later review of this repo, e.g. \"Don't ask for paging on admin-only lists: they hold < 100 rows\""),
  applies_to: z.string().min(1).describe("Where it applies: paths, a layer, a kind of change; 'all' when everywhere"),
  reason: z.string().min(1).describe("Why, in one or two sentences"),
});

type RuleInput = z.infer<typeof ruleInput>;

// Better Review's own tools. They fill the run's draft only; nothing is written until the run succeeds. get_pr_diff is a
// reading tool, so the summary's evidence can cite what it showed.
export function createBetterReviewTools(run: BetterReviewRun, readLog: ReadLog): ToolDefinition<any>[] {
  return [...recordReads([diffTool(run)], readLog), addCommentTool(run), updateCommentTool(run), assessTool(run), summaryTool(run, readLog)];
}

function diffTool(run: BetterReviewRun) {
  const followUp = run.mode.kind === "follow-up";

  return defineTool({
    name: "get_pr_diff",
    description: followUp
      ? "Without a path: the files changed since the last review (+added −removed) and the PR's other files. With a path: what changed in that file since the last review (hunks, new-side line numbers after '+'); full: true gives the file's whole PR diff instead."
      : "Without a path: the PR's changed files (+added −removed) and which of them this review covers. With a path: that file's diff (hunks, 3 lines of context, new-side line numbers after '+').",
    input: {
      path: z.string().default("").describe("A changed file's path as listed, or '' for the list"),
      full: z.boolean().default(false).describe("Follow-up only: the file's whole PR diff (merge base to the PR's commit)"),
    },
    handler: async ({ path, full }) => {
      if (!path) {
        return { text: fileList(run) };
      }

      const file = changedFile(run, path);

      if (!file) {
        return { text: `${path} isn't a changed file of this PR; call get_pr_diff without a path for the list.`, isError: true };
      }

      return { text: full || !followUp ? (run.fullPatches.get(path) ?? file.patch) : file.patch };
    },
  });
}

function addCommentTool(run: BetterReviewRun) {
  return defineTool({
    name: "add_review_comment",
    description: `Add one review comment on lines of a changed file in the PR's commit (new-side line numbers, at most ${MAX_COMMENT_LINES} lines). One issue per comment; never a point a review rule's decision settled.`,
    input: {
      path: z.string().describe("The changed file, as get_pr_diff lists it"),
      start_line: z.number().int().min(1),
      end_line: z.number().int().min(1),
      severity: z.enum(reviewSeverity.enumValues).describe("blocker: critical; major: a real bug or risk; minor: smaller issue; nit: polish. Every unresolved comment, including a nit, blocks approval."),
      category: z.enum(COMMENT_CATEGORIES).describe("business-logic: the change does something the PBI or the domain doesn't want; correctness: a bug in what it does; style: the repo's own conventions; data, performance, security, tests, design"),
      body: z.string().min(1).describe("The problem, why it matters (the PBI rule, the convention with an example of it in the repo, the failing case), and what to do instead"),
    },
    handler: async (input) => {
      const problem = await commentProblem(run, input.path, input.start_line, input.end_line);

      if (problem) {
        return { text: problem, isError: true };
      }

      const snippet = await readSnippet(run, input.path, input.start_line, input.end_line);

      run.draft.comments.push({ path: input.path, startLine: input.start_line, endLine: input.end_line, severity: input.severity, category: input.category, body: input.body, ...snippet });

      return { text: `Comment new:${run.draft.comments.length} noted on ${input.path}:${input.start_line}-${input.end_line}.` };
    },
    replayOnResume: true,
  });
}

function updateCommentTool(run: BetterReviewRun) {
  return defineTool({
    name: "update_comment",
    description: "Decide about an earlier comment: fixed (the code now resolves it), keep (still true; give start_line/end_line when its code moved), refine (reword it), or withdraw (the user's answer or the code shows it's not a problem). When the user declined the fix with a reason you accept, add decision_rule so later reviews don't raise it again.",
    input: {
      id: z.string().describe("The earlier comment's id, e.g. RC-6322-003"),
      action: z.enum(["fixed", "keep", "refine", "withdraw"]),
      reply: z.string().min(1).describe("What you saw: how it was fixed (file and lines), why it still stands, or why you withdraw it; shown under the user's answer"),
      body: z.string().optional().describe("The new comment text (refine only)"),
      start_line: z.number().int().min(1).optional().describe("keep / refine: where the comment's code is now, in the PR's commit"),
      end_line: z.number().int().min(1).optional(),
      decision_rule: ruleInput.optional().describe("Only when the user answered: the decision their answer makes, for the repo's review rules"),
    },
    handler: async (input) => {
      const earlier = run.context?.earlierComments.find((comment) => comment.id === input.id);
      const problem = earlier ? await updateProblem(run, earlier, input) : `${input.id} isn't an earlier comment of this review.`;

      if (problem) {
        return { text: problem, isError: true };
      }

      const anchor = input.start_line ? await anchorOf(run, earlier!, input.start_line, input.end_line ?? input.start_line) : null;
      const source = `PR ${run.context!.pr.id}, ${earlier!.id}`;
      const rule = input.decision_rule ? decisionRule(source, earlier!, input.decision_rule) : null;
      const ruleProblem = rule ? duplicateRule(run, rule) : null;

      if (ruleProblem) {
        return { text: ruleProblem, isError: true };
      }

      run.draft.updates = [...run.draft.updates.filter((update) => update.id !== input.id), { id: input.id, action: input.action, reply: input.reply, body: input.body ?? null, anchor }];
      run.draft.rules = [...run.draft.rules.filter((draft) => draft.source !== source), ...(rule ? [rule] : [])];

      return { text: `${input.id}: ${input.action} noted${rule ? ", with a decision rule" : ""}.` };
    },
    replayOnResume: true,
  });
}

async function updateProblem(run: BetterReviewRun, earlier: CommentRow, input: { action: string; body?: string; start_line?: number; end_line?: number; decision_rule?: RuleInput }): Promise<string | null> {
  const outdated = run.outdatedIds.includes(earlier.id);

  if (outdated && run.mode.kind === "full") {
    return `${earlier.id} is outdated (its code changed) and this is a full review: leave it.`;
  }

  if (input.action === "refine" && !input.body) {
    return "refine needs the new comment text in body.";
  }

  if (input.action === "fixed" && earlier.commit === run.checkout!.sourceCommit) {
    return `${earlier.id} was made on the commit reviewed now, so nothing could have fixed it yet.`;
  }

  if (input.decision_rule && !earlier.answerMd) {
    return `${earlier.id} has no answer from the user: a decision rule comes from the user's answer only.`;
  }

  if (input.start_line && !["keep", "refine"].includes(input.action)) {
    return "start_line / end_line move a comment you keep or refine.";
  }

  return input.start_line ? anchorProblem(run, earlier.filePath, input.start_line, input.end_line ?? input.start_line) : null;
}

async function anchorProblem(run: BetterReviewRun, path: string, startLine: number, endLine: number): Promise<string | null> {
  const file = changedFile(run, path);

  if (!file || file.status === "deleted" || file.status === "binary") {
    return `${path} isn't a changed text file in the PR's commit any more: keep it without lines, or withdraw it.`;
  }

  if (endLine < startLine || endLine - startLine >= MAX_COMMENT_LINES) {
    return `Lines ${startLine}-${endLine}: end must be ≥ start and the range at most ${MAX_COMMENT_LINES} lines.`;
  }

  const lineCount = (await readLines(run, path)).length;

  return endLine > lineCount ? `${path} has ${lineCount} lines in the PR's commit.` : null;
}

async function anchorOf(run: BetterReviewRun, earlier: CommentRow, startLine: number, endLine: number): Promise<CommentAnchor> {
  return { commit: run.checkout!.sourceCommit, startLine, endLine, ...(await readSnippet(run, earlier.filePath, startLine, endLine)) };
}

function decisionRule(source: string, earlier: CommentRow, input: RuleInput): ReviewRuleDraft {
  return { kind: "decision", rule: input.rule, appliesTo: input.applies_to, reason: input.reason, source, sourceText: clip(earlier.answerMd ?? "") };
}

function assessTool(run: BetterReviewRun) {
  return defineTool({
    name: "assess_reviewer_comment",
    description: "Weigh one Azure DevOps thread another reviewer (or the author) left: covered (a comment of yours makes the point), missed (a real point your review didn't make: give the lesson as rule), disagree (the point is wrong: say why), not_applicable (a question answered, praise, a copy of your comment). Call once per new or changed thread (a thread marked weighed keeps the last review's verdict unless you weigh it again); a second call replaces the first.",
    input: {
      thread_id: z.number().int().describe("The thread's id, as listed in <other-reviewers>"),
      verdict: z.enum(["covered", "missed", "disagree", "not_applicable"]),
      covered_by: z.string().optional().describe("covered: your comment that makes the point, an earlier id (RC-6322-003) or new:<n> of this run"),
      note: z.string().min(1).describe("One or two sentences: what the point is and why your verdict"),
      rule: ruleInput.optional().describe("missed: required, the lesson for later reviews (what to check, where). Otherwise only when the thread settles a team decision (e.g. a wontFix the author explained)"),
    },
    handler: async (input) => {
      const thread = threadsOf(run).find((entry) => entry.id === input.thread_id);
      const problem = thread ? assessProblem(run, input) : `Thread ${input.thread_id} isn't one of the PR's threads in <other-reviewers>.`;

      if (problem) {
        return { text: problem, isError: true };
      }

      const first = thread!.comments[0];
      const source = `PR ${run.context!.pr.id}, ADO thread ${input.thread_id} by ${first?.author ?? "unknown"}`;
      const rule: ReviewRuleDraft | null = input.rule
        ? { kind: input.verdict === "missed" ? "lesson" : "decision", rule: input.rule.rule, appliesTo: input.rule.applies_to, reason: input.rule.reason, source, sourceText: clip(first?.content ?? "") }
        : null;
      const ruleProblem = rule ? duplicateRule(run, rule) : null;

      if (ruleProblem) {
        return { text: ruleProblem, isError: true };
      }

      const note: ReviewerNote = { threadId: input.thread_id, verdict: input.verdict, coveredBy: input.covered_by ?? null, note: input.note };

      run.draft.reviewerNotes = [...run.draft.reviewerNotes.filter((entry) => entry.threadId !== input.thread_id), note];
      run.draft.rules = [...run.draft.rules.filter((draft) => draft.source !== source), ...(rule ? [rule] : [])];

      return { text: `Thread ${input.thread_id}: ${input.verdict} noted${rule ? `, with a ${rule.kind} rule` : ""}.` };
    },
    replayOnResume: true,
  });
}

function assessProblem(run: BetterReviewRun, input: { verdict: string; covered_by?: string; rule?: RuleInput }): string | null {
  if (input.verdict === "missed" && !input.rule) {
    return "missed needs rule: the lesson that makes later reviews catch it.";
  }

  if (input.verdict !== "covered") {
    return null;
  }

  if (!input.covered_by) {
    return "covered needs covered_by: the comment that makes the point.";
  }

  const isNew = /^new:(\d+)$/.exec(input.covered_by);
  const known = isNew ? Number(isNew[1]) >= 1 && Number(isNew[1]) <= run.draft.comments.length : run.context!.earlierComments.some((comment) => comment.id === input.covered_by);

  return known ? null : `${input.covered_by} isn't an earlier comment of this review or a new:<n> of this run.`;
}

function duplicateRule(run: BetterReviewRun, rule: ReviewRuleDraft): string | null {
  const existing = run.context!.rules.rules.filter((entry) => entry.active).find((entry) => textSimilarity(entry.title, rule.rule) >= SAME_RULE);

  return existing ? `${existing.id} already says this ("${existing.title}"): leave the rule out.` : null;
}

const criterionInput = z.object({
  pbi: z.string().min(1).describe("PBI-<id>"),
  criterion: z.string().min(1).describe("The acceptance criterion, as the PBI states it"),
  status: z.enum(["met", "partly", "not_met", "not_verifiable", "out_of_scope"]).describe("not_verifiable: the code can't show it (UI, data, another repo); out_of_scope: another PR does it"),
  note: z.string().min(1).describe("Where the change does it, or what is missing"),
  evidence: optionalEvidenceInput.describe("met / partly / not_met: the diff or code you read that shows it"),
});

function summaryTool(run: BetterReviewRun, readLog: ReadLog) {
  return defineTool({
    name: SUMMARY_TOOL,
    description: "Save or replace the review's result: call it once you have checked the earlier comments and weighed every other reviewer's thread; another call replaces the earlier one, and write_result follows the last.",
    input: {
      verdict: z.enum(["ready", "ready_with_fixes", "not_ready"]),
      assessment: z.string().min(1).describe("2-5 sentences: the verdict and why, the main open comments"),
      status: resultStatusInput,
      goals: z.array(z.object({ pbi: z.string(), goal: z.string() })).describe("Each linked PBI's goal in one line, from its description"),
      acceptance_criteria: z.array(criterionInput).describe("Every acceptance criterion of the linked PBIs (and a [BUG] item's parent), checked against the change"),
      business_logic: z.string().min(1).describe("Does the change do what the PBI and the domain rules want, including the cases the criteria don't spell out? What you checked"),
      risks: z.array(z.string()).default([]),
      not_reviewed: z.array(z.object({ what: z.string(), why: z.string() })).default([]).describe("Files or questions this review didn't cover, and why"),
      next_reason: z.string().min(1).describe("Why the research tasks you created are needed, or why none is"),
    },
    handler: async (input) => {
      const problems = [...evidenceProblems(input.acceptance_criteria.flatMap((item) => item.evidence), readLog), ...criteriaProblems(input.acceptance_criteria), ...openWork(run)];
      if (input.verdict === "ready" && effectiveUnresolved(run) > 0) problems.push("ready requires zero unresolved comments, including nits; fix or explicitly withdraw them first");

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      const result: BetterReviewSummary = {
        verdict: input.verdict,
        assessment: input.assessment,
        status: input.status,
        goals: input.goals,
        criteria: input.acceptance_criteria,
        businessLogic: input.business_logic,
        risks: input.risks,
        notReviewed: input.not_reviewed,
        nextReason: input.next_reason,
      };

      run.draft.result = result;
      run.draft.summary = renderSummary(result, reviewerNotesWithCarried(run.context!, run.draft.reviewerNotes));

      return { text: `Review summary saved (${input.verdict}, ${input.status}).` };
    },
    replayOnResume: true,
  });
}

export function effectiveUnresolved(run: BetterReviewRun): number {
  const updates = new Map(run.draft.updates.map(update => [update.id, update.action]));
  const unresolved = run.context!.earlierComments.filter(comment => {
    const action = updates.get(comment.id);
    if (action === "fixed" || action === "withdraw") return false;
    if (action === "keep" || action === "refine") return true;
    if (run.outdatedIds.includes(comment.id)) return false;
    return comment.status === "open" || comment.status === "answered";
  });
  return unresolved.length + run.draft.comments.length;
}

function criteriaProblems(criteria: z.infer<typeof criterionInput>[]): string[] {
  return criteria.filter((item) => ["met", "partly", "not_met"].includes(item.status) && item.evidence.length === 0).map((item) => `"${item.criterion}" is ${item.status}: cite the code that shows it`);
}

// The summary waits for what the review must settle first: every answered comment decided, every thread weighed (in a
// follow-up, the threads the last review weighed and nobody commented on since keep their verdict).
function openWork(run: BetterReviewRun): string[] {
  const decided = new Set(run.draft.updates.map((update) => update.id));
  const automaticallyRetired = new Set(run.mode.kind === "full" ? run.outdatedIds : []);
  const answered = run.context!.earlierComments.filter((comment) => comment.status === "answered" && !decided.has(comment.id) && !automaticallyRetired.has(comment.id)).map((comment) => comment.id);
  const weighed = weighedThreads(run.context!);
  const assessed = new Set(run.draft.reviewerNotes.map((note) => note.threadId));
  const threads = threadsOf(run).filter((thread) => !assessed.has(thread.id) && !weighed.has(thread.id)).map((thread) => thread.id);

  return [
    ...(answered.length > 0 ? [`decide the answered comments first with update_comment: ${answered.join(", ")}`] : []),
    ...(threads.length > 0 ? [`weigh the other reviewers' threads first with assess_reviewer_comment: ${threads.join(", ")}`] : []),
  ];
}

function threadsOf(run: BetterReviewRun): AdoPrThread[] {
  const reviews = run.context?.otherReviews;

  return reviews && "threads" in reviews ? reviews.threads : [];
}

function fileList(run: BetterReviewRun): string {
  const reviewed = run.scope.reviewed.map((file) => `- ${describe(file)}`);
  const skipped = run.scope.skipped.map(({ file, reason }) => `- ${describe(file)}: ${reason}`);
  const heading = run.mode.kind === "follow-up" ? `Changed since the last review (${run.mode.baseCommit.slice(0, 8)}), review these` : "Review these";

  return [`${heading} (${reviewed.length}):`, ...reviewed, "", `Not in this review (${skipped.length}):`, ...skipped].join("\n");
}

function clip(text: string): string {
  const line = text.trim().replaceAll(/\s+/g, " ");

  return line.length > MAX_QUOTE ? `${line.slice(0, MAX_QUOTE)}…` : line;
}
