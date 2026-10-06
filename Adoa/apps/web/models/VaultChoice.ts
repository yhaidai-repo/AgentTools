// The vaults configured in Settings and the one the pages show; null while there is none.
export interface VaultChoice {
  vaults: string[];
  current: string | null;
}
