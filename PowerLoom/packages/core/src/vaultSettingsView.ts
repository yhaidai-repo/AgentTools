import type { PowerLoomDb } from "@powerloom/db";
import type { VaultSettingsView } from "./models/VaultSettingsView";
import { readImportSourceActivity } from "./pbiImports";
import { listVaultRepos } from "./repos";
import { adoView, azureView, sqlView } from "./settingsViews";
import { readAdoSettings, readAzureUserAccount, readCleanupSettings, readDevHubSettings, readGitHubSettings, readImportSettings, readPullRequestSettings, readReadAzureSettings, readReadSqlSettings, readSyncSettings } from "./settings";
import { readVault } from "./vaults";

// What the Settings page shows for a vault, without its secrets (settings.get).
export async function readVaultSettingsView(db: PowerLoomDb, vault: string): Promise<VaultSettingsView> {
  const devHub = await readDevHubSettings(db, vault);
  const github = await readGitHubSettings(db, vault);

  return {
    vault,
    features: (await readVault(db, vault))?.features ?? null,
    ado: adoView(await readAdoSettings(db, vault)),
    sync: await readSyncSettings(db, vault),
    imports: { settings: await readImportSettings(db, vault), sources: await readImportSourceActivity(db, vault) },
    pullRequests: await readPullRequestSettings(db, vault),
    repos: (await listVaultRepos(db, vault)).map((repo) => ({ id: repo.id, name: repo.name, kind: repo.kind, enabled: !repo.excluded, defaultBranch: repo.defaultBranch })),
    readSql: sqlView(await readReadSqlSettings(db, vault)),
    readAzure: azureView(await readReadAzureSettings(db, vault), (await readAzureUserAccount(db, vault))?.username ?? null),
    devHub: { enabled: devHub.enabled, url: devHub.url, hasToken: devHub.token.length > 0 },
    github: { enabled: github.enabled, owner: github.owner, login: github.login, hasToken: github.token.length > 0 },
    cleanup: await readCleanupSettings(db, vault),
  };
}
