import { pbiRepo, refinement, repo, type AdoaDb } from "@adoa/db";
import type { RepoRef } from "@agenttools/runtime";
import { desc, eq } from "drizzle-orm";

const DEFAULT_BRANCH = "main";
const CLONED_SOURCES: string[] = ["vault-documented", "user-confirmed"];

// Repos for a PBI: the ones a vault project documents or the user confirmed (user decision 2026-10-02); an unconfirmed
// guess isn't cloned. PBIs refined before repos were recorded (no pbi_repo rows) keep the latest refinement's list.
export async function resolveRepos(db: AdoaDb, adoId: number): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  const recorded = await db.select({ source: pbiRepo.source, name: repo.name }).from(pbiRepo).innerJoin(repo, eq(repo.id, pbiRepo.repoId)).where(eq(pbiRepo.pbiId, adoId));

  if (recorded.length > 0) {
    return reposByName(db, recorded.filter((row) => CLONED_SOURCES.includes(row.source)).map((row) => row.name));
  }

  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return reposByName(db, (latest?.repos ?? []).map((choice) => choice.name));
}

// Repo names matched to the org repo catalog (case-insensitive); the ones it doesn't know are returned as unknown.
export async function reposByName(db: AdoaDb, wanted: string[]): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  const catalog = await db.select().from(repo).where(eq(repo.excluded, false));
  const byName = new Map(catalog.map((row) => [row.name.toLowerCase(), row]));
  const found = wanted.filter((name) => byName.has(name.toLowerCase()));

  return {
    repos: found.map((name) => toRepoRef(byName.get(name.toLowerCase())!)),
    unknown: wanted.filter((name) => !byName.has(name.toLowerCase())),
  };
}

function toRepoRef(row: typeof repo.$inferSelect): RepoRef {
  return {
    name: folderName(row.name),
    remoteUrl: row.remoteUrl,
    defaultBranch: (row.defaultBranch ?? DEFAULT_BRANCH).replace(/^refs\/heads\//, ""),
  };
}

// Repo names can contain spaces; agents see the same folder name in every path.
function folderName(name: string): string {
  return name.replaceAll(/[^\w.-]+/g, "-");
}
