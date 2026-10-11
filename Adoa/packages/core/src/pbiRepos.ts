import { pbiRepo, refinement, repo, type AdoaDb } from "@adoa/db";
import { desc, eq } from "drizzle-orm";

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
