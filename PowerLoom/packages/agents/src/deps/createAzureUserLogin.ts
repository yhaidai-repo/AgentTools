import { AzureUserLogin } from "@powerloom/azure";
import { AZURE_USER_KEY, AZURE_USER_TOKEN_CACHE_KEY, readValue, saveValue, vaultSettingKey } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";

// The user's own sign-in for Azure (user decisions 2026-10-13/14): the MSAL cache and the account live in the config
// table per vault, the only settings a host writes. The cache text is wrapped in an object: the Postgres driver
// sends a bare string into the jsonb column as JSON, and MSAL's JSON text would come back parsed.
export function createAzureUserLogin(db: PowerLoomDb): AzureUserLogin {
  return new AzureUserLogin({
    read: async (vault) => (await readValue<{ msal: string }>(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY)))?.msal ?? null,
    write: (vault, cache) => saveValue(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY), { msal: cache }),
    clear: (vault) => saveValue(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY), null),
    saveAccount: (vault, account) => saveValue(db, vaultSettingKey(vault, AZURE_USER_KEY), account),
  });
}
