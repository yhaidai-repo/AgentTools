import { vaultsDir } from "@powerloom/vault";
import type { PowerLoomDb } from "@powerloom/db";
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { readVault } from "../vaults";
import type { Outcome } from "../models/Outcome";

// The vault's folder on disk (under the vaults root, bind-mounted at the same place in every container); null when the
// root isn't mounted.
export function vaultRootOf(vault: string): string | null {
  const root = vaultsDir();
  if (!root || !isVaultFolderName(vault)) return null;
  try {
    const base = realpathSync(root);
    const target = realpathSync(join(base, vault));
    const child = relative(base, target);
    const equal = process.platform === "win32" ? child.toLowerCase() === vault.toLowerCase() : child === vault;
    return equal ? target : null;
  } catch {
    return null;
  }
}

export function isVaultFolderName(vault: string): boolean {
  return vault.length > 0 && vault !== "." && vault !== ".." && !/[\\/:\x00-\x1f]/.test(vault) && !/[. ]$/.test(vault);
}

// The vault's folder for a read command: an `ok: false` names what's missing, the mount or the vault.
export async function mountedVaultRoot(vault: string, db: PowerLoomDb): Promise<Outcome<string>> {
  if (!isVaultFolderName(vault) || !await readVault(db, vault)) {
    return { ok: false, error: `${vault} isn't an active vault.` };
  }
  if (!vaultsDir()) {
    return { ok: false, error: "The vaults folder isn't mounted (VAULTS_DIR)." };
  }
  const root = vaultRootOf(vault);
  if (!root) return { ok: false, error: `Vault ${vault} has no contained folder under the vaults root.` };

  const exists = await stat(root).then((info) => info.isDirectory(), () => false);

  return exists ? { ok: true, value: root } : { ok: false, error: `Vault ${vault} has no folder under the vaults root.` };
}
