import { repo, type AdoaDb } from "@adoa/db";
import { and, asc, eq } from "drizzle-orm";
import type { RepoRow } from "./models/RepoRow";

// Repository configuration per vault (user decision 2026-10-06): the ADO integration fills the catalog with its repos;
// local repos are added through PowerLoom. Agents and the PBI repo choice see the enabled ones only.

export async function listVaultRepos(db: AdoaDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(eq(repo.vault, vault)).orderBy(asc(repo.name));
}

export async function enabledRepos(db: AdoaDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(and(eq(repo.vault, vault), eq(repo.excluded, false))).orderBy(asc(repo.name));
}

// Matched by name, case-insensitively, against the vault's enabled repos (the refinement agent's repo confirmation).
export async function catalogRepos(db: AdoaDb, vault: string, names: string[]): Promise<RepoRow[]> {
  const wanted = new Set(names.map((name) => name.toLowerCase()));

  return (await enabledRepos(db, vault)).filter((row) => wanted.has(row.name.toLowerCase()));
}
