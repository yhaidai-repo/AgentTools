import { repo, type PowerLoomDb } from "@powerloom/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { RepoRow } from "./models/RepoRow";

// Repository configuration per vault (user decision 2026-10-06): the ADO integration fills the catalog with its repos;
// local repos are added through PowerLoom. Agents and the PBI repo choice see the enabled ones only.

export async function listVaultRepos(db: PowerLoomDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(eq(repo.vault, vault)).orderBy(asc(repo.excluded), asc(repo.name));
}

export async function enabledRepos(db: PowerLoomDb, vault: string): Promise<RepoRow[]> {
  return db.select().from(repo).where(and(eq(repo.vault, vault), eq(repo.excluded, false))).orderBy(asc(repo.name));
}

// Matched by name, case-insensitively, against the vault's enabled repos (the refinement agent's repo confirmation).
export async function catalogRepos(db: PowerLoomDb, vault: string, names: string[]): Promise<RepoRow[]> {
  const wanted = new Set(names.map((name) => name.toLowerCase()));

  return (await enabledRepos(db, vault)).filter((row) => wanted.has(row.name.toLowerCase()));
}

// One catalogue repo by name, in any case, enabled or not (a repo's commands may be set before it is switched on).
export async function catalogRepoNamed(db: PowerLoomDb, vault: string, name: string): Promise<RepoRow | null> {
  const rows = await db.select().from(repo).where(and(eq(repo.vault, vault), eq(sql`lower(${repo.name})`, name.toLowerCase())));

  return rows[0] ?? null;
}
