import type { PowerLoomDb } from "@powerloom/db";
import type { VaultSettingsView } from "./models/VaultSettingsView";
import type { RepoCommandSettings } from "./models/RepoCommandSettings";
import type { RepoRow } from "./models/RepoRow";
import type { SandboxSettingsView } from "./models/SandboxSettingsView";
import { packageFeedsView, readPackageFeedSettings } from "./packageFeeds";
import { readImportSourceActivity } from "./pbiImports";
import { buildCommandsOf } from "./repoCommands";
import { listVaultRepos } from "./repos";
import { adoView, azureView, sqlView } from "./settingsViews";
import { readAdoSettings, readAzureUserAccount, readCleanupSettings, readDevHubSettings, readGitHubSettings, readGoogleDriveSettings, readImportSettings, readPullRequestSettings, readReadAzureSettings, readReadSqlSettings, readRepoCommandSettings, readSandboxSettings, readSyncSettings } from "./settings";
import { readVault } from "./vaults";

// What the Settings page shows for a vault, without its secrets (settings.get).
export async function readVaultSettingsView(db: PowerLoomDb, vault: string): Promise<VaultSettingsView> {
  const devHub = await readDevHubSettings(db, vault);
  const github = await readGitHubSettings(db, vault);
  const drive = await readGoogleDriveSettings(db, vault);

  return {
    vault,
    features: (await readVault(db, vault))?.features ?? null,
    ado: adoView(await readAdoSettings(db, vault)),
    sync: await readSyncSettings(db, vault),
    imports: { settings: await readImportSettings(db, vault), sources: await readImportSourceActivity(db, vault) },
    pullRequests: await readPullRequestSettings(db, vault),
    repos: reposView(await listVaultRepos(db, vault), await readRepoCommandSettings(db, vault)),
    sandbox: await sandboxView(db, vault),
    readSql: sqlView(await readReadSqlSettings(db, vault)),
    readAzure: azureView(await readReadAzureSettings(db, vault), (await readAzureUserAccount(db, vault))?.username ?? null),
    devHub: { enabled: devHub.enabled, url: devHub.url, hasToken: devHub.token.length > 0 },
    github: { enabled: github.enabled, owner: github.owner, login: github.login, hasToken: github.token.length > 0 },
    googleDrive: { enabled: drive.enabled, account: drive.account, folders: drive.folders },
    cleanup: await readCleanupSettings(db, vault),
  };
}

// The sandbox's image, package hosts and private feeds without their tokens (sandbox_saveSettings and sandbox_savePackageFeed set them).
async function sandboxView(db: PowerLoomDb, vault: string): Promise<SandboxSettingsView> {
  const settings = await readSandboxSettings(db, vault);

  return { image: settings.image, packageHosts: settings.packageHosts, feeds: packageFeedsView(await readPackageFeedSettings(db, vault)) };
}

// Each catalogue repo with its switch and its build and test commands (repo_saveCommands sets them).
function reposView(repos: RepoRow[], commands: RepoCommandSettings): VaultSettingsView["repos"] {
  return repos.map((repo) => ({ id: repo.id, name: repo.name, kind: repo.kind, enabled: !repo.excluded, defaultBranch: repo.defaultBranch, ...buildCommandsOf(commands, repo.name) }));
}
