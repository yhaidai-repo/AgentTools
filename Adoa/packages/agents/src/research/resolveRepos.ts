import { refinement, repo, type AdoaDb } from "@adoa/db";
import type { RepoRef } from "@agenttools/runtime";
import { desc, eq } from "drizzle-orm";

const DEFAULT_BRANCH = "main";

// Repos for a PBI: the latest refinement's list matched to the org repo catalog by name.
export async function resolveRepos(db: AdoaDb, adoId: number): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);
  const wanted = (latest?.repos ?? []).map((choice) => choice.name);
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
