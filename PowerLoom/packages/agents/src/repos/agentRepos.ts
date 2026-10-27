import { catalogRepos, pbiRepoNames, vaultOfPbi } from "@powerloom/core";
import type { PowerLoomDb, repo } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";
import type { RepoSource } from "../models/RepoSource";

const DEFAULT_BRANCH = "main";

export type CatalogRepoRef = RepoRef & { catalogId?: string; catalogName?: string };

// The repos an agent reads: the names its task carries, matched case-insensitively to each vault's enabled repos, so a
// disabled or unknown name is left out (user decision 2026-10-13), and each repo once.
export async function agentRepos(db: PowerLoomDb, sources: RepoSource[]): Promise<CatalogRepoRef[]> {
  const perSource = await Promise.all(sources.map(async (source) => (await catalogRepos(db, source.vault, source.names)).map(toRepoRef)));
  return mergeRepoRefs(perSource.flat());
}

// Reject distinct identities before a folder-keyed cache or tool set can silently keep only one of them.
export function mergeRepoRefs(refs: CatalogRepoRef[]): CatalogRepoRef[] {
  const byFolder = new Map<string, CatalogRepoRef>();
  for (const ref of refs) {
    const key = ref.name.toLowerCase();
    const previous = byFolder.get(key);
    if (previous) {
      if (previous.catalogId !== ref.catalogId || previous.remoteUrl !== ref.remoteUrl || previous.defaultBranch !== ref.defaultBranch || previous.catalogName?.toLowerCase() !== ref.catalogName?.toLowerCase()) {
        throw new Error(`Repository names "${previous.catalogName ?? previous.name}" and "${ref.catalogName ?? ref.name}" collide at folder "${ref.name}"`);
      }
    } else byFolder.set(key, ref);
  }
  return [...byFolder.values()];
}

// The repos attached to a PBI (its documented and confirmed ones), in the PBI's vault.
export async function pbiRepoSources(db: PowerLoomDb, adoId: number): Promise<RepoSource[]> {
  const vault = await vaultOfPbi(db, adoId);

  return vault ? [{ vault, names: await pbiRepoNames(db, adoId) }] : [];
}

export function toRepoRef(row: typeof repo.$inferSelect): CatalogRepoRef {
  return {
    catalogId: row.id,
    catalogName: row.name,
    name: repoFolderName(row.name),
    remoteUrl: row.remoteUrl,
    defaultBranch: (row.defaultBranch ?? DEFAULT_BRANCH).replace(/^refs\/heads\//, ""),
  };
}

// Repo names can contain spaces; agents see the same folder name in every path.
export function repoFolderName(name: string): string {
  return name.replaceAll(/[^\w.-]+/g, "-");
}
