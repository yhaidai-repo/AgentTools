import { inVaultRuns, runInVault, vaultRunIds as vaultRunIdsOf } from "@powerloom/core";
import { getDb } from "./db";

export { inVaultRuns, runInVault };

// The ids of the vault's agent runs since `from` (core's vaultRunIds with the web's database).
export function vaultRunIds(from: Date, vault: string): Promise<Set<string>> {
  return vaultRunIdsOf(getDb(), from, vault);
}
