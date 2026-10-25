import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { backlogMountOf, buildPbiContext } from "@powerloom/core";
import { codeReview, localItem, workItem, type PowerLoomDb, type pullRequest } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ADO_INTEGRATION } from "../ado/adoTools";
import { PULL_REQUESTS, adoResource } from "../ado/adoToolResults";
import { withoutSystemComments } from "../ado/pullRequestMarkdown";
import { loadReviewContext } from "../codeReview/loadReviewContext";
import { GITHUB_ORIGIN, LOCAL_REPO_ORIGIN } from "../codeReview/localRepoHead";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { TaskContext } from "../models/TaskContext";
import type { BetterReviewContext } from "./models/BetterReviewContext";
import type { OtherReviews } from "./models/OtherReviews";
import type { ResearchFollowUp } from "./models/ResearchFollowUp";
import type { ReviewerNote } from "./models/ReviewerNote";
import type { ReviewRules } from "./models/ReviewRules";
import { parseReviewRules, reviewRulesPath } from "./reviewRules";

type PullRequestRow = typeof pullRequest.$inferSelect;

// A PBI's whole context can be long (answers, related items); a PR linking many PBIs gets the first ones in full and the
// rest as code review's summaries, which read_pbi opens.
const MAX_FULL_PBIS = 3;
const MAX_PBI_CHARS = 15_000;

// Code review's context, plus what Better Review reads before it starts (user decision 2026-10-16): the linked PBIs in
// full (goals and acceptance criteria), the repo's review rules, the other reviewers' ADO threads, the research earlier
// runs of this review asked for, and the last review's commit.
export async function loadBetterReviewContext(context: TaskContext, pr: PullRequestRow, repo: RepoRef, access: OutsideAccessContext): Promise<BetterReviewContext> {
  const { deps } = context;
  const base = await loadReviewContext(deps.db, pr, repo);

  return {
    ...base,
    pbiTexts: await loadPbiTexts(deps, base.linkedPbis.filter((pbi) => pbi.title !== null).map((pbi) => pbi.adoId)),
    rules: await loadReviewRules(deps, repo.name),
    otherReviews: await loadOtherReviews(context, pr, access),
    research: await loadResearchFollowUps(deps.db, pr.id),
    previous: await loadPrevious(deps.db, pr.id),
  };
}

async function loadPbiTexts(deps: AgentDeps, adoIds: number[]): Promise<{ adoId: number; text: string }[]> {
  const ids = adoIds.slice(0, MAX_FULL_PBIS);
  const rows = ids.length > 0 ? await deps.db.select().from(workItem).where(inArray(workItem.adoId, ids)) : [];

  return Promise.all(rows.map(async (row) => ({ adoId: row.adoId, text: clip(await buildPbiContext(deps.db, backlogMountOf(deps.vaultRoot), row)) })));
}

export async function loadReviewRules(deps: AgentDeps, repoName: string): Promise<ReviewRules> {
  const path = reviewRulesPath(repoName);
  const text = deps.docsVault ? await deps.docsVault.readNote(path) : await readFile(join(deps.docsRoot, path), "utf8").catch(() => null);

  return { path, rules: text ? parseReviewRules(text) : [], writable: deps.docsVault !== null };
}

// The PR's threads as the ADO tools read them (people's comments only), logged like a tool call to the same API.
async function loadOtherReviews(context: TaskContext, pr: PullRequestRow, access: OutsideAccessContext): Promise<OtherReviews> {
  const { deps, agent } = context;

  if (pr.origin === "local" || pr.origin === "pc" || pr.origin === LOCAL_REPO_ORIGIN) {
    return { unavailable: "a branch review has no pull request, so there are no other reviewers' comments" };
  }

  if (pr.origin === GITHUB_ORIGIN) {
    return { unavailable: "other reviewers' comments on a GitHub pull request aren't read yet" };
  }

  if (agent.capabilities.integrations?.[ADO_INTEGRATION] !== true) {
    return { unavailable: "Azure DevOps (read) is off in this agent's Config, so the other reviewers' comments weren't read" };
  }

  if (!deps.ado) {
    return { unavailable: "the vault's Azure DevOps isn't set up in Settings, so the other reviewers' comments weren't read" };
  }

  const startedAt = new Date();
  const entry = { ...access, ...adoResource(deps.ado, PULL_REQUESTS), tool: "better-review:threads", request: `threads of PR ${pr.id}`, startedAt, truncated: false, bytes: null };

  try {
    const threads = withoutSystemComments(await deps.ado.client.getPullRequestThreads(pr.repoId, pr.id));

    await deps.accessLog.record({ ...entry, outcome: "ok", reason: null, rows: threads.length, durationMs: Date.now() - startedAt.getTime() });

    return { threads };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    await deps.accessLog.record({ ...entry, outcome: "failed", reason, rows: null, durationMs: Date.now() - startedAt.getTime() });

    return { unavailable: `reading the PR's threads failed (${reason})` };
  }
}

// Research tasks the review's earlier runs created (their parent is a review task of this PR), with their final result.
async function loadResearchFollowUps(db: PowerLoomDb, prId: number): Promise<ResearchFollowUp[]> {
  const reviewTasks = await db.select({ id: localItem.id }).from(localItem).where(and(eq(localItem.kind, "review"), sql`(${localItem.data}->>'prId')::int = ${prId}`));
  const taskIds = reviewTasks.map((row) => row.id);
  const research = taskIds.length > 0 ? await db.select().from(localItem).where(and(eq(localItem.kind, "research"), inArray(localItem.parentId, taskIds))).orderBy(localItem.id) : [];
  const results = research.length > 0 ? await db.select().from(localItem).where(and(eq(localItem.kind, "research-result"), eq(localItem.status, "final"), inArray(localItem.parentId, research.map((row) => row.id)))) : [];

  return research.map((task) => {
    const result = results.find((row) => row.parentId === task.id) ?? null;

    return { taskId: task.id, title: task.title, status: task.status, resultId: result?.id ?? null, conclusion: result?.body ?? null };
  });
}

async function loadPrevious(db: PowerLoomDb, prId: number): Promise<BetterReviewContext["previous"]> {
  const [row] = await db.select({ commit: codeReview.reviewedCommit, summaryMd: codeReview.summaryMd, details: codeReview.details }).from(codeReview).where(eq(codeReview.prId, prId));
  const details = (row?.details ?? null) as { agent?: string; reviewerNotes?: ReviewerNote[]; threadsSeen?: Record<string, number> } | null;
  const ours = details?.agent === "better-review";

  return row?.commit
    ? { commit: row.commit, summaryMd: row.summaryMd, reviewerNotes: ours ? details.reviewerNotes ?? [] : [], threadsSeen: ours ? details.threadsSeen ?? {} : {} }
    : null;
}

function clip(text: string): string {
  return text.length > MAX_PBI_CHARS ? `${text.slice(0, MAX_PBI_CHARS)}\n… (cut; read_pbi gives the rest)` : text;
}
