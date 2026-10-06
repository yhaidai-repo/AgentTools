import { localItem, vault, workItem, type AdoaDb, type VaultFeatures } from "@adoa/db";
import { vaultsExclude } from "@adoa/vault";
import { and, asc, count, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { join } from "node:path";
import type { Outcome } from "./models/Outcome";
import type { Vault } from "./models/Vault";

// A new vault does nothing until its features are switched on (user decision 2026-10-05).
const NO_VAULT_FEATURES: VaultFeatures = { adoSync: false, mailSync: false, pullRequests: false };

const WAITING = ["open", "in-progress", "blocked"] as const;
const FOLDER_NAME = /^[^\\/:*?"<>|.][^\\/:*?"<>|]*$/;

// A vault's rendered backlog: its own folder of adoa's backlog vault (user decision 2026-10-05: adoa-backlog/<vault>/).
export function vaultBacklogRoot(backlogMount: string, vault: string): string {
  return join(backlogMount, vault);
}

// The vaults adoa works for, as configured in Settings; removed ones are left out.
export async function readVaults(db: AdoaDb): Promise<Vault[]> {
  return db.select().from(vault).where(isNull(vault.removedAt)).orderBy(asc(vault.name));
}

export async function readVault(db: AdoaDb, name: string): Promise<Vault | null> {
  const [row] = await db.select().from(vault).where(and(eq(vault.name, name), isNull(vault.removedAt)));

  return row ?? null;
}

// The vault a PBI belongs to; null for a PBI adoa doesn't have.
export async function vaultOfPbi(db: AdoaDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ vault: workItem.vault }).from(workItem).where(eq(workItem.adoId, adoId));

  return row?.vault ?? null;
}

// For inserts of a PBI's items: the PBI's vault, resolved by the database (a trigger does the same for inserts that
// don't name it, so an item is always in its PBI's vault).
export function vaultOfPbiSql(adoId: number): SQL<string> {
  return sql<string>`(select ${workItem.vault} from ${workItem} where ${workItem.adoId} = ${adoId})`;
}

// The vault of PBIs acted on together (one page's selection): the first PBI adoa has decides.
export async function vaultOfPbis(db: AdoaDb, adoIds: number[]): Promise<string | null> {
  const rows = await db.select({ vault: workItem.vault }).from(workItem).where(inArray(workItem.adoId, adoIds)).limit(1);

  return rows[0]?.vault ?? null;
}

// One feature's switch, saved with that feature's settings (user decision 2026-10-06: each feature's section has it).
export async function setVaultFeature(db: AdoaDb, name: string, feature: keyof VaultFeatures, enabled: boolean): Promise<void> {
  const [row] = await db.select({ features: vault.features }).from(vault).where(eq(vault.name, name));

  if (!row) {
    throw new Error(`${name} isn't a vault`);
  }

  await db.update(vault).set({ features: { ...row.features, [feature]: enabled } }).where(eq(vault.name, name));
}

// The mail import folder: a folder inside the import inbox; null = the inbox root.
export async function saveVaultImportFolder(db: AdoaDb, name: string, importFolder: string | null): Promise<void> {
  await db.update(vault).set({ importFolder }).where(eq(vault.name, name));
}

// What the user typed, as a folder name under the vaults root: the name itself, or the folder's path on the PC.
export function vaultFolderName(input: string, hostVaultsRoot: string | null): Outcome<string> {
  const path = input.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  const root = hostVaultsRoot?.toLowerCase();
  const name = root && path.toLowerCase().startsWith(`${root}/`) ? path.slice(root.length + 1) : path;

  return FOLDER_NAME.test(name) ? { ok: true, value: name } : { ok: false, error: `A vault is a folder directly inside ${hostVaultsRoot ?? "the vaults root"}.` };
}

// Adds a folder of the vaults root as a vault, with every feature off; a vault removed earlier comes back as it was. The
// folder needn't exist: the worker's vault-init job creates it with adoa's templates (user decision 2026-10-05).
export async function addVault(db: AdoaDb, name: string): Promise<Outcome<Vault>> {
  if (vaultsExclude().includes(name)) {
    return { ok: false, error: `${name} is adoa's own vault and can't be added.` };
  }

  const [existing] = await db.select().from(vault).where(eq(vault.name, name));

  if (existing && !existing.removedAt) {
    return { ok: false, error: `${name} is a vault already.` };
  }

  const [row] = existing
    ? await db.update(vault).set({ removedAt: null }).where(eq(vault.name, name)).returning()
    : await db.insert(vault).values({ name, features: NO_VAULT_FEATURES }).returning();

  return { ok: true, value: row };
}

// adoa forgets the vault; its folder and its history stay (user decision 2026-10-05). Refused while the vault has PBIs or
// waiting tasks, and for the last vault, because every page shows one.
export async function removeVault(db: AdoaDb, name: string): Promise<Outcome<string>> {
  const problem = await removalProblem(db, name);

  if (problem) {
    return { ok: false, error: problem };
  }

  await db.update(vault).set({ removedAt: new Date() }).where(eq(vault.name, name));

  return { ok: true, value: name };
}

async function removalProblem(db: AdoaDb, name: string): Promise<string | null> {
  const vaults = await readVaults(db);

  if (!vaults.some((entry) => entry.name === name)) {
    return `${name} isn't a vault.`;
  }

  if (vaults.length === 1) {
    return "adoa needs one vault; add another before removing this one.";
  }

  const [pbis] = await db.select({ total: count() }).from(workItem).where(eq(workItem.vault, name));
  const [tasks] = await db.select({ total: count() }).from(localItem).where(and(eq(localItem.vault, name), inArray(localItem.status, [...WAITING])));

  return pbis.total + tasks.total > 0 ? `${name} still has ${pbis.total} PBI(s) and ${tasks.total} waiting task(s).` : null;
}
