import { enabledRepos, pbiRepoNames, vaultOfPbi } from "@powerloom/core";
import type { repo, PowerLoomDb } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";

const DEFAULT_BRANCH = "main";

// Repos cloned for a PBI: its documented or confirmed ones (`pbiRepoNames`), matched to the catalog.
export async function resolveRepos(db: PowerLoomDb, adoId: number): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  const vault = await vaultOfPbi(db, adoId);

  return vault ? reposByName(db, vault, await pbiRepoNames(db, adoId)) : { repos: [], unknown: [] };
}

// Repo names matched to the vault's enabled repos (case-insensitive); the ones it doesn't know are returned as unknown.
export async function reposByName(db: PowerLoomDb, vault: string, wanted: string[]): Promise<{ repos: RepoRef[]; unknown: string[] }> {
  const catalog = await enabledRepos(db, vault);
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
