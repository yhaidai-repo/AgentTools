import { repo, type AdoaDb } from "@adoa/db";
import { and, asc, eq } from "drizzle-orm";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Outcome } from "./models/Outcome";
import type { RepoRow } from "./models/RepoRow";

// Repository configuration per vault (user decision 2026-10-06): the ADO integration fills the catalog with its repos;
// local repos (folders under the repos root) are added by hand. Agents and the PBI repo choice see the enabled ones only.
const LOCAL_NAME = /^[\w.-]+$/;

export async function listVaultRepos(db: AdoaDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(eq(repo.vault, vault)).orderBy(asc(repo.name));
}

export async function enabledRepos(db: AdoaDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(and(eq(repo.vault, vault), eq(repo.excluded, false))).orderBy(asc(repo.name));
}

// Matched by name, case-insensitively, against the vault's enabled repos.
export async function catalogRepos(db: AdoaDb, vault: string, names: string[]): Promise<RepoRow[]> {
  const wanted = new Set(names.map((name) => name.toLowerCase()));

  return (await enabledRepos(db, vault)).filter((row) => wanted.has(row.name.toLowerCase()));
}

export async function setRepoEnabled(db: AdoaDb, vault: string, id: string, enabled: boolean): Promise<void> {
  await db.update(repo).set({ excluded: !enabled }).where(and(eq(repo.vault, vault), eq(repo.id, id)));
}

// A local repo is a git checkout in the repos root, named by its folder (the same name the chats and clones use). The
// containers see the root at `reposMount`; null when it isn't mounted, then the folder isn't checked.
export async function addLocalRepo(db: AdoaDb, vault: string, name: string, reposMount: string | null): Promise<Outcome<RepoRow>> {
  const folder = name.trim();
  const problem = await localRepoProblem(db, vault, folder, reposMount);

  if (problem) {
    return { ok: false, error: problem };
  }

  const [row] = await db
    .insert(repo)
    .values({ id: localRepoId(vault, folder), vault, kind: "local", adoProject: "", name: folder, remoteUrl: reposMount ? join(reposMount, folder) : folder, defaultBranch: null })
    .returning();

  return { ok: true, value: row };
}

export async function removeLocalRepo(db: AdoaDb, vault: string, id: string): Promise<void> {
  await db.delete(repo).where(and(eq(repo.vault, vault), eq(repo.id, id), eq(repo.kind, "local")));
}

function localRepoId(vault: string, folder: string): string {
  return `local:${vault}:${folder}`;
}

async function localRepoProblem(db: AdoaDb, vault: string, folder: string, reposMount: string | null): Promise<string | null> {
  if (!LOCAL_NAME.test(folder)) {
    return "A local repo is one folder name inside the repos root.";
  }

  const existing = await listVaultRepos(db, vault);

  if (existing.some((row) => row.name.toLowerCase() === folder.toLowerCase())) {
    return `${folder} is in the vault's repositories already.`;
  }

  if (!reposMount) {
    return null;
  }

  const git = await stat(join(reposMount, folder, ".git")).catch(() => null);

  return git ? null : `${folder} isn't a git repository in the repos root.`;
}
