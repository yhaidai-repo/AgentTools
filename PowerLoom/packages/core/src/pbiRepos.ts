import { pbiRepo, refinement, repo, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { PbiRepoEntry } from "./models/PbiRepoEntry";
import { catalogRepos } from "./repos";
import { vaultOfPbi } from "./vaults";

export type { PbiRepoEntry } from "./models/PbiRepoEntry";

const REFINEMENT_SOURCE = "refinement";
const WORKED_ON_SOURCES: string[] = ["vault-documented", "user-confirmed", REFINEMENT_SOURCE];

// A PBI's repos as its page lists them. Repos disabled in Settings are left out (user decision 2026-10-13), so neither
// the page nor an agent offers them. PBIs refined before repos were recorded (no pbi_repo rows) keep the latest
// refinement's list.
export async function pbiRepoEntries(db: PowerLoomDb, adoId: number): Promise<PbiRepoEntry[]> {
  const recorded = await recordedRepos(db, adoId);

  if (recorded.length > 0) {
    return recorded.filter((row) => !row.excluded).map(({ name, source, questionId }) => ({ name, source, questionId }));
  }

  return refinementRepos(db, adoId);
}

// The repos a PBI is worked on in: the ones a vault project documents or the user confirmed (user decision 2026-10-02);
// an unconfirmed guess is left out.
export async function pbiRepoNames(db: PowerLoomDb, adoId: number): Promise<string[]> {
  const entries = await pbiRepoEntries(db, adoId);

  return entries.filter((entry) => WORKED_ON_SOURCES.includes(entry.source)).map((entry) => entry.name);
}

async function recordedRepos(db: PowerLoomDb, adoId: number) {
  return db
    .select({ name: repo.name, source: pbiRepo.source, questionId: pbiRepo.questionId, excluded: repo.excluded })
    .from(pbiRepo)
    .innerJoin(repo, eq(repo.id, pbiRepo.repoId))
    .where(eq(pbiRepo.pbiId, adoId))
    .orderBy(repo.name);
}

// The refinement stores the agent's names as written; only the enabled catalog repos they name count, each once.
async function refinementRepos(db: PowerLoomDb, adoId: number): Promise<PbiRepoEntry[]> {
  const vault = await vaultOfPbi(db, adoId);
  const [latest] = await db.select({ repos: refinement.repos }).from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  if (!vault || !latest) {
    return [];
  }

  const repos = await catalogRepos(db, vault, latest.repos.map((choice) => choice.name));

  return repos.map((row) => ({ name: row.name, source: REFINEMENT_SOURCE, questionId: null }));
}
