import { readVaults } from "@powerloom/core";
import { cookies } from "next/headers";
import { getDb } from "./db";

// The selected vault (the web's cookie, shared on 127.0.0.1): the one picked in the web's top bar, or the first when
// none (or a removed one) is remembered; null while no vault is configured. The switch stays in the web app.
export const VAULT_COOKIE = "powerloom_vault";

export interface VaultChoice {
  vaults: string[];
  current: string | null;
}

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
