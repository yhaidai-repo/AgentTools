import { readVaults } from "@powerloom/core";
import { cookies } from "next/headers";
import type { VaultChoice } from "@/models/VaultChoice";
import { getDb } from "./db";
import { VAULT_COOKIE } from "./sharedFilters";

// The vault's folder as the web sees it (read-only) lives in core's vaultPage domain, shared with the vault commands.
export { vaultRootOf } from "@powerloom/core";

// The vault every page shows: the one picked in the top bar, or the first when none (or a removed one) is remembered;
// null while no vault is configured (the pages then show the Add vault placeholder, user decision 2026-10-06).
export async function vaultChoice(): Promise<VaultChoice> {
  const remembered = (await cookies()).get(VAULT_COOKIE)?.value;
  const vaults = (await readVaults(getDb())).map((vault) => vault.name);

  return { vaults, current: vaults.find((name) => name === remembered) ?? vaults[0] ?? null };
}

export async function currentVault(): Promise<string | null> {
  return (await vaultChoice()).current;
}

// For actions, which only exist on a page that has a vault.
export async function requireVault(): Promise<string> {
  const vault = await currentVault();

  if (!vault) {
    throw new Error("No vault is configured.");
  }

  return vault;
}
