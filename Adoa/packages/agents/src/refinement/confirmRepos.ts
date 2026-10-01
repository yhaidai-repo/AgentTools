import { catalogRepos, hasItemWithKey, repoConfirmationKey, setItemStatus } from "@adoa/core";
import { localItem, pbiRepo, repo, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { insertQuestions } from "./insertQuestions";
import type { QuestionDraft } from "./models/QuestionDraft";

const ACTOR = "agent:refinement";

type RepoRow = typeof repo.$inferSelect;

// The agent picks the repos; the user confirms its guesses (user decision 2026-09-27), but not the repos a vault
// project's index names (user decision 2026-10-02). Recorded per PBI in pbi_repo: research clones only documented and
// confirmed repos, and a repo the user confirmed stays confirmed in later refinements.
export async function confirmRepos(db: AdoaDb, adoId: number, runId: number, names: string[], documented: Map<string, string>): Promise<string[]> {
  const picked = await catalogRepos(db, names);

  await recordPicks(db, adoId, picked, documented);

  const toAsk = await assumedRepos(db, adoId);

  if (toAsk.length === 0) {
    await dismissOpenRepoQuestions(db, adoId, null, runId, "Not needed any more: the vault documents the PBI's repos, or you confirmed them.");

    return [];
  }

  const key = repoConfirmationKey(toAsk.map((row) => row.name));

  if (await hasItemWithKey(db, adoId, key)) {
    return [];
  }

  const [id] = await insertQuestions(db, adoId, runId, [repoQuestion(adoId, toAsk, picked, documented)], key);

  await db.update(pbiRepo).set({ questionId: id }).where(and(eq(pbiRepo.pbiId, adoId), inArray(pbiRepo.repoId, toAsk.map((row) => row.id))));
  await dismissOpenRepoQuestions(db, adoId, id, runId, `Replaced by ${id} (the repo list changed).`);

  return [id];
}

// A new pick replaces the earlier guesses; repos the user confirmed are kept.
async function recordPicks(db: AdoaDb, adoId: number, picked: RepoRow[], documented: Map<string, string>): Promise<void> {
  await db.delete(pbiRepo).where(and(eq(pbiRepo.pbiId, adoId), ne(pbiRepo.source, "user-confirmed")));

  if (picked.length === 0) {
    return;
  }

  const rows = picked.map((row) => ({ pbiId: adoId, repoId: row.id, source: documented.has(row.name.toLowerCase()) ? "vault-documented" as const : "agent-assumed" as const }));

  await db.insert(pbiRepo).values(rows).onConflictDoNothing();
}

async function assumedRepos(db: AdoaDb, adoId: number): Promise<RepoRow[]> {
  const rows = await db.select({ repo }).from(pbiRepo).innerJoin(repo, eq(repo.id, pbiRepo.repoId)).where(and(eq(pbiRepo.pbiId, adoId), eq(pbiRepo.source, "agent-assumed")));

  return rows.map((row) => row.repo);
}

function repoQuestion(adoId: number, toAsk: RepoRow[], picked: RepoRow[], documented: Map<string, string>): QuestionDraft {
  const fromVault = picked.filter((row) => documented.has(row.name.toLowerCase())).map((row) => `${row.name} (${documented.get(row.name.toLowerCase())})`);
  const vaultNote = fromVault.length > 0 ? ` Already known from the vault: ${fromVault.join(", ")}.` : "";

  return {
    question: `Confirm repos for PBI-${adoId}: ${toAsk.map((row) => row.name).join(", ")}`,
    why: `Research and design clone only confirmed repos.${vaultNote}`,
    options: ["Confirm", "Correct the list: answer with the repos to use, comma-separated"],
  };
}

async function dismissOpenRepoQuestions(db: AdoaDb, adoId: number, keepId: string | null, runId: number, resolution: string): Promise<void> {
  const older = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), keepId ? ne(localItem.id, keepId) : sql`true`, inArray(localItem.status, ["open", "in-progress"]), like(sql`${localItem.data}->>'key'`, "repos:%")));

  for (const question of older) {
    await db.update(localItem).set({ resolution }).where(eq(localItem.id, question.id));
    await setItemStatus(db, question.id, "open", "dismissed", ACTOR, runId);
  }
}
