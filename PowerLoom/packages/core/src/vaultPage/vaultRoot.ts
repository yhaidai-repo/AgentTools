import { vaultsDir } from "@powerloom/vault";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Outcome } from "../models/Outcome";

// The vault's folder on disk (under the vaults root, bind-mounted at the same place in every container); null when the
// root isn't mounted.
export function vaultRootOf(vault: string): string | null {
  const root = vaultsDir();

  return root ? join(root, vault) : null;
}

// The vault's folder for a read command: an `ok: false` names what's missing, the mount or the vault.
export async function mountedVaultRoot(vault: string): Promise<Outcome<string>> {
  const root = vaultRootOf(vault);

  if (!root) {
    return { ok: false, error: "The vaults folder isn't mounted (VAULTS_DIR)." };
  }

  const exists = await stat(root).then((info) => info.isDirectory(), () => false);

  return exists ? { ok: true, value: root } : { ok: false, error: `Vault ${vault} has no folder under the vaults root.` };
}
