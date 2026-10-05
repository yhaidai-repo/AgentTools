import type { DocsVault } from "./DocsVault";

// Every vault under the vaults root (user decision 2026-10-03), for the vault review and the tech-writer's actualize tasks.
export interface VaultsAccess {
  /** The vaults root inside the container, e.g. /vaults; a vault is the folder `<root>/<name>`. */
  root: string;
  /** Path-guarded writes inside one vault. */
  writer(vault: string): DocsVault;
}
