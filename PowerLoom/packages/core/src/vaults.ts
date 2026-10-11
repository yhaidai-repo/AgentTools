import { localItem, vault, workItem, type PowerLoomDb, type VaultFeatures } from "@powerloom/db";
import { vaultsExclude } from "@powerloom/vault";
import { and, asc, count, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { join } from "node:path";
import type { Outcome } from "./models/Outcome";
import type { Vault } from "./models/Vault";



// A vault's rendered backlog: its own folder of PowerLoom's backlog vault (user decision 2026-10-05: powerloom-backlog/<vault>/).
export function vaultBacklogRoot(backlogMount: string, vault: string): string {
  return join(backlogMount, vault);
}

// The vaults PowerLoom works for, as configured in Settings; removed ones are left out.
export async function readVaults(db: PowerLoomDb): Promise<Vault[]> {
  return db.select().from(vault).where(isNull(vault.removedAt)).orderBy(asc(vault.name));
}

export async function readVault(db: PowerLoomDb, name: string): Promise<Vault | null> {
  const [row] = await db.select().from(vault).where(and(eq(vault.name, name), isNull(vault.removedAt)));

  return row ?? null;
}

// The vault a PBI belongs to; null for a PBI PowerLoom doesn't have.
export async function vaultOfPbi(db: PowerLoomDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ vault: workItem.vault }).from(workItem).where(eq(workItem.adoId, adoId));

  return row?.vault ?? null;
}

// For inserts of a PBI's items: the PBI's vault, resolved by the database (a trigger does the same for inserts that
// don't name it, so an item is always in its PBI's vault).
export function vaultOfPbiSql(adoId: number): SQL<string> {
  return sql<string>`(select ${workItem.vault} from ${workItem} where ${workItem.adoId} = ${adoId})`;
}

// The vault of PBIs acted on together (one page's selection): the first PBI PowerLoom has decides.
export async function vaultOfPbis(db: PowerLoomDb, adoIds: number[]): Promise<string | null> {
  const rows = await db.select({ vault: workItem.vault }).from(workItem).where(inArray(workItem.adoId, adoIds)).limit(1);

  return rows[0]?.vault ?? null;
}

// One feature's switch, saved with that feature's settings (user decision 2026-10-06: each feature's section has it).
export async function setVaultFeature(db: PowerLoomDb, name: string, feature: keyof VaultFeatures, enabled: boolean): Promise<void> {
  const [row] = await db.select({ features: vault.features }).from(vault).where(eq(vault.name, name));

  if (!row) {
    throw new Error(`${name} isn't a vault`);
  }

  await db.update(vault).set({ features: { ...row.features, [feature]: enabled } }).where(eq(vault.name, name));
}

// The mail import folder: a folder inside the import inbox; null = the inbox root.
export async function saveVaultImportFolder(db: PowerLoomDb, name: string, importFolder: string | null): Promise<void> {
  await db.update(vault).set({ importFolder }).where(eq(vault.name, name));
}
