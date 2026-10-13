import type { AzureUserAccount } from "./AzureUserAccount";

// Where a vault's MSAL token cache (its refresh token) and the signed-in account live; the runner keeps them in
// PowerLoom's config table.
export interface AzureTokenCacheStore {
  read(vault: string): Promise<string | null>;
  write(vault: string, cache: string): Promise<void>;
  clear(vault: string): Promise<void>;
  saveAccount(vault: string, account: AzureUserAccount | null): Promise<void>;
}
