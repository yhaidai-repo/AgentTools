import { pbiRepo, repo, type AdoaDb, type localItem } from "@adoa/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { CloseItemRequest } from "./models/CloseItemRequest";
import { catalogRepos } from "./pbiRepos";

type ItemRow = typeof localItem.$inferSelect;
type RepoRow = typeof repo.$inferSelect;

const REPO_KEY_PREFIX = "repos:";
const CONFIRMS = /^\s*(confirm(ed)?|yes|ok)\b/i;

// The answer to refinement's repo question (user decision 2026-10-02): "Confirm" keeps the asked repos, a list names
// the repos to use instead, and Dismiss drops the guesses. Checked before anything is stored.
export async function repoAnswerProblem(db: AdoaDb, item: ItemRow, request: CloseItemRequest): Promise<string | null> {
  if (!isRepoQuestion(item) || request.decision !== "answer" || isConfirmation(request.resolution)) {
    return null;
  }

  const names = listedRepos(request.resolution);

  if (names.length === 0) {
    return "Answer \"Confirm\", or the repos to use, comma-separated.";
  }

  const known = await catalogRepos(db, names);
  const unknown = names.filter((name) => !known.some((row) => row.name.toLowerCase() === name.toLowerCase()));

  return unknown.length > 0 ? `Not in the repo catalog: ${unknown.join(", ")}.` : null;
}

export async function applyRepoAnswer(db: AdoaDb, item: ItemRow, request: CloseItemRequest): Promise<void> {
  if (!isRepoQuestion(item) || item.pbiId === null) {
    return;
  }

  const asked = await catalogRepos(db, askedRepos(item));

  if (request.decision === "dismiss") {
    await dropRepos(db, item.pbiId, asked);

    return;
  }

  const chosen = isConfirmation(request.resolution) ? asked : await catalogRepos(db, listedRepos(request.resolution));

  await confirmRepos(db, item.pbiId, item.id, chosen);
  await dropRepos(db, item.pbiId, asked.filter((row) => !chosen.some((choice) => choice.id === row.id)));
}

function isRepoQuestion(item: ItemRow): boolean {
  return item.kind === "question" && repoKey(item).startsWith(REPO_KEY_PREFIX);
}

// The question's key lists the repos it asked about, e.g. "repos:AA-Automation-Tests,PVS.Internal".
function askedRepos(item: ItemRow): string[] {
  return repoKey(item).slice(REPO_KEY_PREFIX.length).split(",").filter(Boolean);
}

function repoKey(item: ItemRow): string {
  return String((item.data as { key?: string } | null)?.key ?? "");
}

function isConfirmation(resolution: string | null): boolean {
  return CONFIRMS.test(resolution ?? "");
}

function listedRepos(resolution: string | null): string[] {
  return (resolution ?? "").split(/[,;\n]/).map((name) => name.trim()).filter(Boolean);
}

async function confirmRepos(db: AdoaDb, pbiId: number, questionId: string, rows: RepoRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db.insert(pbiRepo)
    .values(rows.map((row) => ({ pbiId, repoId: row.id, source: "user-confirmed" as const, questionId })))
    .onConflictDoUpdate({ target: [pbiRepo.pbiId, pbiRepo.repoId], set: { source: "user-confirmed", questionId } });
}

// Guesses the user didn't keep; what the vault documents stays.
async function dropRepos(db: AdoaDb, pbiId: number, rows: RepoRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db.delete(pbiRepo).where(and(eq(pbiRepo.pbiId, pbiId), inArray(pbiRepo.repoId, rows.map((row) => row.id)), ne(pbiRepo.source, "vault-documented")));
}
