import { localItem, pbiRepo, refinement, repo, type AdoaDb } from "@adoa/db";
import { and, desc, eq, inArray, like, notInArray, sql } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";
import { setItemStatus } from "./pbiStatus";

type RepoRow = typeof repo.$inferSelect;

const ACTOR = "human";
const WORKED_ON_SOURCES: string[] = ["vault-documented", "user-confirmed"];

// The repos a PBI is worked on in: the ones a vault project documents or the user confirmed (user decision 2026-10-02);
// an unconfirmed guess is left out. PBIs refined before repos were recorded (no pbi_repo rows) keep the latest refinement's list.
export async function pbiRepoNames(db: AdoaDb, adoId: number): Promise<string[]> {
  const recorded = await db.select({ source: pbiRepo.source, name: repo.name }).from(pbiRepo).innerJoin(repo, eq(repo.id, pbiRepo.repoId)).where(eq(pbiRepo.pbiId, adoId));

  if (recorded.length > 0) {
    return recorded.filter((row) => WORKED_ON_SOURCES.includes(row.source)).map((row) => row.name);
  }

  const [latest] = await db.select({ repos: refinement.repos }).from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return (latest?.repos ?? []).map((choice) => choice.name);
}

// The user's repo list for a PBI, set on its page (user decision 2026-10-02): what research and design clone. Repos the
// vault documents keep that source; every other kept or added repo is confirmed by the user; removed ones are dropped.
// It answers refinement's open repo question too.
export async function savePbiRepos(db: AdoaDb, adoId: number, names: string[]): Promise<Outcome<number>> {
  const chosen = await catalogRepos(db, names);
  const unknown = names.filter((name) => !chosen.some((row) => row.name.toLowerCase() === name.toLowerCase()));

  if (unknown.length > 0) {
    return { ok: false, error: `Not in the repo catalog: ${unknown.join(", ")}.` };
  }

  await dropOthers(db, adoId, chosen);
  await confirmChosen(db, adoId, chosen);
  await answerOpenRepoQuestions(db, adoId);

  return { ok: true, value: chosen.length };
}

// Matched by name, case-insensitively, against the repos that aren't excluded.
export async function catalogRepos(db: AdoaDb, names: string[]): Promise<RepoRow[]> {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const catalog = await db.select().from(repo).where(eq(repo.excluded, false));

  return catalog.filter((row) => wanted.has(row.name.toLowerCase()));
}

async function dropOthers(db: AdoaDb, adoId: number, chosen: RepoRow[]): Promise<void> {
  const keptIds = chosen.map((row) => row.id);

  await db.delete(pbiRepo).where(and(eq(pbiRepo.pbiId, adoId), keptIds.length > 0 ? notInArray(pbiRepo.repoId, keptIds) : sql`true`));
}

async function confirmChosen(db: AdoaDb, adoId: number, chosen: RepoRow[]): Promise<void> {
  if (chosen.length === 0) {
    return;
  }

  await db.insert(pbiRepo).values(chosen.map((row) => ({ pbiId: adoId, repoId: row.id, source: "user-confirmed" as const }))).onConflictDoNothing();
  await db.update(pbiRepo).set({ source: "user-confirmed" }).where(and(eq(pbiRepo.pbiId, adoId), eq(pbiRepo.source, "agent-assumed")));
}

async function answerOpenRepoQuestions(db: AdoaDb, adoId: number): Promise<void> {
  const open = await db
    .select({ id: localItem.id, status: localItem.status })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), inArray(localItem.status, ["open", "in-progress"]), like(sql`${localItem.data}->>'key'`, "repos:%")));

  for (const question of open) {
    await db.update(localItem).set({ resolution: "Set on the PBI page." }).where(eq(localItem.id, question.id));
    await setItemStatus(db, question.id, question.status, "answered", ACTOR);
  }
}
