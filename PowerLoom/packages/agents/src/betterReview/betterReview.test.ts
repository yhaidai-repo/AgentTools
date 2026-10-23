import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AdoPrThread } from "@powerloom/ado";
import type { reviewComment } from "@powerloom/db";
import type { DiffFile } from "../codeReview/models/DiffFile";
import { ReadLog } from "../evidence/ReadLog";
import { noRepos } from "../repos/openRepos";
import { loadPrompt } from "../prompts";
import { createBetterReviewTools } from "./betterReviewTools";
import { buildBetterReviewMessage } from "./betterReviewMessage";
import type { BetterReviewContext } from "./models/BetterReviewContext";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import type { ReviewMode } from "./models/ReviewMode";
import { renderSummary } from "./renderSummary";
import { appendReviewRules, parseReviewRules, reviewRulesPath } from "./reviewRules";
import { followUpScope } from "./reviewScope";
import { commentKeys, lastCommentIds, reviewerNotesWithCarried } from "./threadsSeen";

type CommentRow = typeof reviewComment.$inferSelect;

const HEAD = "bbbbbbbbbbbbbbbb";
const BASE = "aaaaaaaaaaaaaaaa";

function file(path: string, added = 5): DiffFile {
  return { path, oldPath: null, status: "modified", added, removed: 0, patch: `diff --git a/${path} b/${path}\n@@ -1,1 +1,${added} @@` };
}

function comment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: "RC-7-001", prId: 7, runId: 1, commit: BASE, filePath: "Repo/src/a.ts", startLine: 2, endLine: 3, severity: "major", category: "correctness",
    bodyMd: "total is never reset", codeSnippet: "", snippetStartLine: 1, status: "open", answerMd: null, answeredAt: null, agentReplyMd: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  } as CommentRow;
}

function thread(id: number, content: string): AdoPrThread {
  return { id, status: "active", filePath: "/src/a.ts", startLine: 4, endLine: 4, comments: [{ id: 1, parentId: 0, author: "Dana", createdAt: null, type: "text", content, isDeleted: false }] };
}

async function runWith(options: { comments?: CommentRow[]; threads?: AdoPrThread[]; mode?: ReviewMode; outdated?: string[]; rules?: string; previous?: BetterReviewContext["previous"] } = {}): Promise<BetterReviewRun> {
  const root = await mkdtemp(join(tmpdir(), "better-review-"));

  await mkdir(join(root, "Repo", "src"), { recursive: true });
  await writeFile(join(root, "Repo", "src", "a.ts"), Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n"));

  const files = [file("Repo/src/a.ts")];

  return {
    context: {
      pr: { id: 7, title: "Reset totals", sourceCommit: HEAD } as never,
      repo: { name: "Repo" } as never,
      earlierComments: options.comments ?? [],
      linkedPbis: [],
      pbiTexts: [],
      rules: { path: reviewRulesPath("Repo"), rules: options.rules ? parseReviewRules(options.rules) : [], writable: true },
      otherReviews: { threads: options.threads ?? [] },
      research: [],
      previous: options.previous ?? null,
    },
    checkout: { path: root, sourceCommit: HEAD, mergeBase: "m" } as never,
    scope: { reviewed: files, skipped: [] },
    mode: options.mode ?? { kind: "follow-up", baseCommit: BASE },
    fullPatches: new Map(files.map((entry) => [entry.path, `${entry.patch}\nFULL`])),
    triggerThreads: null,
    outdatedIds: options.outdated ?? [],
    repos: noRepos(),
    toolset: null,
    draft: { summary: null, comments: [], updates: [], result: null, reviewerNotes: [], rules: [] },
  };
}

function tool(run: BetterReviewRun, name: string, log = new ReadLog("PBI-1: totals reset per batch")) {
  const found = createBetterReviewTools(run, log).find((entry) => entry.name === name);

  assert.ok(found, name);

  return found;
}

const SUMMARY = {
  verdict: "ready_with_fixes",
  assessment: "Totals reset now; one comment stays.",
  status: "complete",
  goals: [{ pbi: "PBI-1", goal: "Reset totals per batch" }],
  acceptance_criteria: [{ pbi: "PBI-1", criterion: "Totals reset per batch", status: "met", note: "reset in run()", evidence: [{ source: "S0", ref: "PBI-1", note: "the criterion" }] }],
  business_logic: "Batches are independent, as the PBI says.",
  risks: [],
  not_reviewed: [],
  next_reason: "Nothing open needs research.",
};

describe("review rules note", () => {
  it("appends rules with the next free id and reads which are active", () => {
    const first = appendReviewRules(null, "Repo", [{ kind: "decision", rule: "Don't ask for paging on admin lists", appliesTo: "Api/Admin", reason: "under 100 rows", source: "PR 7, RC-7-001", sourceText: "they stay small" }], "2026-10-16");
    const retired = first.text.replace("## RV-001", "## [RESOLVED] RV-001");
    const second = appendReviewRules(retired, "Repo", [{ kind: "lesson", rule: "Check AdminOnly on new admin endpoints", appliesTo: "Api/Admin", reason: "missed once", source: "PR 8, ADO thread 3 by Dana", sourceText: "no policy?" }], "2026-10-17");
    const rules = parseReviewRules(second.text);

    assert.deepEqual(first.ids, ["RV-001"]);
    assert.deepEqual(second.ids, ["RV-002"]);
    assert.deepEqual(rules.map((rule) => [rule.id, rule.active]), [["RV-001", false], ["RV-002", true]]);
    assert.match(second.text, /^title: Review rules – Repo$/m);
  });

  it("keeps a repo name safe as a file name", () => {
    assert.equal(reviewRulesPath("PVS Internal/x"), "review-rules/PVS-Internal-x.md");
  });
});

describe("follow-up scope", () => {
  it("reviews only the PR's files changed since the anchor and lists the rest as unchanged", () => {
    const scope = followUpScope([file("a.ts"), file("b.ts")], [file("a.ts", 2), file("from-main.ts")], BASE, 3000);

    assert.deepEqual(scope.reviewed.map((entry) => entry.path), ["a.ts"]);
    assert.equal(scope.reviewed[0].added, 2);
    assert.deepEqual(scope.skipped.map((entry) => [entry.file.path, entry.reason]), [["b.ts", "unchanged since the last review (aaaaaaaa)"]]);
  });
});

describe("Better Review tools", () => {
  it("shows the change since the anchor, and the whole PR diff on request", async () => {
    const run = await runWith();
    const diff = tool(run, "get_pr_diff");

    assert.doesNotMatch((await diff.handler({ path: "Repo/src/a.ts", full: false })).text, /FULL/);
    assert.match((await diff.handler({ path: "Repo/src/a.ts", full: true })).text, /FULL/);
  });

  it("marks a comment fixed and moves a kept one to its lines now", async () => {
    const run = await runWith({ comments: [comment(), comment({ id: "RC-7-002", startLine: 8, endLine: 8 })], outdated: ["RC-7-001", "RC-7-002"] });
    const update = tool(run, "update_comment");

    assert.ok(!(await update.handler({ id: "RC-7-001", action: "fixed", reply: "reset in run() line 4" })).isError);
    assert.ok(!(await update.handler({ id: "RC-7-002", action: "keep", reply: "still unchecked", start_line: 10, end_line: 11 })).isError);
    assert.equal(run.draft.updates[1].anchor?.startLine, 10);
    assert.equal(run.draft.updates[1].anchor?.commit, HEAD);
    assert.match(run.draft.updates[1].anchor?.snippet ?? "", /line 10/);
  });

  it("takes a decision rule only from the user's answer, and not twice", async () => {
    const rules = appendReviewRules(null, "Repo", [{ kind: "decision", rule: "Don't ask for paging on admin lists", appliesTo: "all", reason: "small", source: "PR 1, RC-1-001", sourceText: "small" }], "2026-10-16").text;
    const run = await runWith({ comments: [comment(), comment({ id: "RC-7-002", status: "answered", answerMd: "Admin lists stay small, no paging." })], rules });
    const update = tool(run, "update_comment");
    const rule = { rule: "Don't ask for paging on admin lists", applies_to: "Api/Admin", reason: "they stay small" };

    assert.ok((await update.handler({ id: "RC-7-001", action: "withdraw", reply: "ok", decision_rule: rule })).isError);
    assert.match((await update.handler({ id: "RC-7-002", action: "withdraw", reply: "ok", decision_rule: rule })).text, /RV-001 already says this/);
    assert.ok(!(await update.handler({ id: "RC-7-002", action: "withdraw", reply: "ok", decision_rule: { ...rule, rule: "Admin endpoints need no rate limit" } })).isError);
    assert.equal(run.draft.rules[0].source, "PR 7, RC-7-002");
    assert.equal(run.draft.rules[0].sourceText, "Admin lists stay small, no paging.");
  });

  it("needs a lesson for a missed point and turns it into a rule", async () => {
    const run = await runWith({ threads: [thread(31, "No AdminOnly policy on this endpoint?")] });
    const assess = tool(run, "assess_reviewer_comment");

    assert.ok((await assess.handler({ thread_id: 31, verdict: "missed", note: "real" })).isError);
    assert.ok((await assess.handler({ thread_id: 99, verdict: "not_applicable", note: "-" })).isError);
    assert.ok(!(await assess.handler({ thread_id: 31, verdict: "missed", note: "real", rule: { rule: "Check AdminOnly on new admin endpoints", applies_to: "Api/Admin", reason: "missed in PR 7" } })).isError);
    assert.equal(run.draft.rules[0].kind, "lesson");
    assert.match(run.draft.rules[0].source, /ADO thread 31 by Dana/);
  });

  it("writes the summary only once answers are decided and threads weighed", async () => {
    const run = await runWith({ comments: [comment({ status: "answered", answerMd: "done differently" })], threads: [thread(31, "nit")] });
    const summary = tool(run, "write_review_summary");

    assert.match((await summary.handler(SUMMARY)).text, /RC-7-001.*31|31.*RC-7-001/s);
    await tool(run, "update_comment").handler({ id: "RC-7-001", action: "keep", reply: "still applies" });
    await tool(run, "assess_reviewer_comment").handler({ thread_id: 31, verdict: "not_applicable", note: "style nit the formatter fixes" });
    assert.ok(!(await summary.handler(SUMMARY)).isError);
    assert.match(run.draft.summary ?? "", /Ready with fixes/);
    assert.match(run.draft.summary ?? "", /✓ met/);
  });

  it("refuses a criterion marked met without the code that shows it", async () => {
    const run = await runWith();
    const result = await tool(run, "write_review_summary").handler({ ...SUMMARY, acceptance_criteria: [{ ...SUMMARY.acceptance_criteria[0], evidence: [] }] });

    assert.match(result.text, /cite the code/);
  });

  it("refuses to decide an outdated comment in a full review", async () => {
    const run = await runWith({ comments: [comment()], outdated: ["RC-7-001"], mode: { kind: "full", reason: "first" } });

    assert.match((await tool(run, "update_comment").handler({ id: "RC-7-001", action: "fixed", reply: "x" })).text, /full review/);
  });
});

describe("reviewer threads in a follow-up", () => {
  const weighed = { commit: BASE, summaryMd: null, reviewerNotes: [{ threadId: 1, verdict: "covered" as const, coveredBy: "RC-7-001", note: "same as ours" }, { threadId: 2, verdict: "disagree" as const, coveredBy: null, note: "the cache is per request" }], threadsSeen: { "1": 1, "2": 1 } };

  function answered(id: number): AdoPrThread {
    const base = thread(id, "why a cache here?");

    return { ...base, comments: [...base.comments, { id: 2, parentId: 1, author: "Lee", createdAt: null, type: "text", content: "it is still wrong", isDeleted: false }] };
  }

  it("asks only for the new and changed threads and carries the other verdicts", async () => {
    const run = await runWith({ threads: [thread(1, "total is never reset"), answered(2), thread(3, "name it resetTotals")], previous: weighed });
    const summary = tool(run, "write_review_summary");
    const refused = await summary.handler(SUMMARY);

    assert.ok(refused.isError);
    assert.match(refused.text, /assess_reviewer_comment: 2, 3/);

    await tool(run, "assess_reviewer_comment").handler({ thread_id: 2, verdict: "disagree", note: "still per request" });
    await tool(run, "assess_reviewer_comment").handler({ thread_id: 3, verdict: "not_applicable", note: "naming is fine" });

    assert.ok(!(await summary.handler(SUMMARY)).isError);
    assert.deepEqual(reviewerNotesWithCarried(run.context!, run.draft.reviewerNotes).map((note) => [note.threadId, note.note]), [[1, "same as ours"], [2, "still per request"], [3, "naming is fine"]]);
  });

  it("marks weighed threads and the sync's trigger in the first message", async () => {
    const run = await runWith({ threads: [thread(1, "total is never reset"), answered(2)], previous: weighed });
    const message = buildBetterReviewMessage(run.context!, run.checkout!, { reviewed: [], skipped: [] }, run.mode, [], [2]);

    assert.match(message, /Thread 1 \[active, weighed: covered by RC-7-001: same as ours\]/);
    assert.match(message, /Thread 2 \[active\] on/);
    assert.match(message, /other reviewers commented on thread\(s\) 2 since the last review/);
    assert.match(message, /No code changed since then/);
  });

  it("remembers the comments it saw", () => {
    assert.deepEqual(lastCommentIds([thread(1, "a"), answered(2)]), { "1": 1, "2": 2 });
    assert.deepEqual(commentKeys([answered(2)]), ["2:1", "2:2"]);
  });
});

describe("Better Review summary and prompt", () => {
  it("renders the reviewer notes", () => {
    const text = renderSummary({ verdict: "not_ready", assessment: "a", status: "complete", goals: [], criteria: [], businessLogic: "b", risks: [], notReviewed: [], nextReason: "c" }, [{ threadId: 3, verdict: "covered", coveredBy: "RC-7-004", note: "same point" }]);

    assert.match(text, /Thread 3: covered by RC-7-004/);
  });

  it("starts from the shared framework", async () => {
    const prompt = await loadPrompt("better-review", { team: "Core" });

    assert.match(prompt.version, /^v3\+framework\./);
    assert.match(prompt.text, /## How you work/);
    assert.match(prompt.text, /Better Review of the Core team/);
  });
});
