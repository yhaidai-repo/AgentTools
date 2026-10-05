import { pbiRepoNames } from "@adoa/core";
import { repo, type AdoaDb } from "@adoa/db";
import type { RepoRef } from "@agenttools/runtime";
import { eq } from "drizzle-orm";

const DEFAULT_BRANCH = "main";

// Repos cloned for a PBI: its documented or confirmed ones (`pbiRepoNames`), matched to the catalog.
export async function resolveRepos(db: AdoaDb, adoId: number): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  return reposByName(db, await pbiRepoNames(db, adoId));
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
