import { config, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AdoSettings } from "./models/AdoSettings";
import type { CleanupSettings } from "./models/CleanupSettings";
import type { ConfluenceStatus } from "./models/ConfluenceStatus";
import type { ImportRunStatus } from "./models/ImportRunStatus";
import type { ImportSettings } from "./models/ImportSettings";
import type { DevHubSettings } from "./models/DevHubSettings";
import type { PullRequestSettings } from "./models/PullRequestSettings";
import type { AzureUserAccount } from "./models/AzureUserAccount";
import type { ReadAzureSettings } from "./models/ReadAzureSettings";
import type { ReadSqlSettings } from "./models/ReadSqlSettings";
import type { SyncSettings } from "./models/SyncSettings";

// Settings are per vault (user decision 2026-10-05): the key is `vault:<name>:<setting>`. Confluence access is global.
const ADO_KEY = "ado";
const SYNC_KEY = "sync";
const CONFLUENCE_KEY = "confluence";
const IMPORT_KEY = "import";
const IMPORT_STATUS_KEY = "importStatus";
const CLEANUP_KEY = "cleanup";
const PULL_REQUESTS_KEY = "pullRequests";
const READ_SQL_KEY = "readSql";
const READ_AZURE_KEY = "readAzure";
// "localStack": the stored key from before the rename to DevHub (2026-10-14): saved settings keep working.
const DEVHUB_KEY = "localStack";
// DevHub on the Windows host, as Docker containers reach it (DevSecrets Start-DevHub.ps1).
export const DEFAULT_DEVHUB_URL = "http://host.docker.internal:47811";
// Written by the agent-runner (the user's sign-in for App Insights): the account the page shows, and the MSAL cache.
export const AZURE_USER_KEY = "azureUser";
export const AZURE_USER_TOKEN_CACHE_KEY = "azureUserTokenCache";

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  cron: "*/30 * * * *",
  maxItemsPerRun: 400,
  sprint: "current",
};

const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  cron: "*/5 * * * *",
  maxItemsPerRun: 50,
};

// The same defaults as PowerLoom's CleanupSettings (the buffers decided 2026-10-21).
const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  dryRun: true,
  closedPbiDays: 30,
  trashDays: 90,
  failedImportDays: 30,
  runEventDays: 90,
  browserArtefactDays: 14,
  failedRunBrowserArtefactDays: 60,
};

const DEFAULT_PULL_REQUEST_SETTINGS: PullRequestSettings = {
  cron: "*/15 * * * *",
  maxPullRequestsPerRun: 50,
  repos: [],
};

export function vaultSettingKey(vault: string, setting: string): string {
  return `vault:${vault}:${setting}`;
}

const DEFAULT_ADO_SETTINGS: AdoSettings = { enabled: false, orgUrl: "", project: "", team: "", user: "", pat: "" };

// Null until the vault's integration was saved once.
export async function readAdoSettings(db: PowerLoomDb, vault: string): Promise<AdoSettings | null> {
  const stored = await readValue<Partial<AdoSettings>>(db, vaultSettingKey(vault, ADO_KEY));

  return stored ? { ...DEFAULT_ADO_SETTINGS, ...stored } : null;
}

export async function saveAdoSettings(db: PowerLoomDb, vault: string, settings: AdoSettings): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, ADO_KEY), settings);
}

export async function readSyncSettings(db: PowerLoomDb, vault: string): Promise<SyncSettings> {
  const stored = await readValue<Partial<SyncSettings>>(db, vaultSettingKey(vault, SYNC_KEY));

  return { ...DEFAULT_SYNC_SETTINGS, ...stored };
}

export async function saveSyncSettings(db: PowerLoomDb, vault: string, settings: SyncSettings): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, SYNC_KEY), settings);
}

// Sync pulls only the PBIs assigned to `user`, so it is required; the token too.
export function isAdoConfigured(settings: AdoSettings | null): settings is AdoSettings {
  return !!settings && [settings.orgUrl, settings.project, settings.team, settings.user, settings.pat].every(Boolean);
}

// Switched on and complete: only then do PBI sync, mail sync and pull request sync exist (user decision 2026-10-06).
export function isAdoActive(settings: AdoSettings | null): settings is AdoSettings {
  return isAdoConfigured(settings) && settings.enabled;
}

export async function saveConfluenceStatus(db: PowerLoomDb, status: ConfluenceStatus): Promise<void> {
  await saveValue(db, CONFLUENCE_KEY, status);
}

// Null until a worker has started with this build.
export async function readConfluenceStatus(db: PowerLoomDb): Promise<ConfluenceStatus | null> {
  return readValue<ConfluenceStatus>(db, CONFLUENCE_KEY);
}

export async function readImportSettings(db: PowerLoomDb, vault: string): Promise<ImportSettings> {
  const stored = await readValue<Partial<ImportSettings>>(db, vaultSettingKey(vault, IMPORT_KEY));

  return { ...DEFAULT_IMPORT_SETTINGS, ...stored };
}

// The buffers PowerLoom's cleanup job reads (its CleanupSettings; key `cleanup`); dry run until switched off.
export async function readCleanupSettings(db: PowerLoomDb, vault: string): Promise<CleanupSettings> {
  const stored = await readValue<Partial<CleanupSettings>>(db, vaultSettingKey(vault, CLEANUP_KEY));

  return { ...DEFAULT_CLEANUP_SETTINGS, ...stored };
}

export async function saveImportSettings(db: PowerLoomDb, vault: string, settings: ImportSettings): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, IMPORT_KEY), settings);
}

export async function saveImportStatus(db: PowerLoomDb, vault: string, status: ImportRunStatus): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, IMPORT_STATUS_KEY), status);
}

// Null until the vault's pbi-import job has run once.
export async function readImportStatus(db: PowerLoomDb, vault: string): Promise<ImportRunStatus | null> {
  return readValue<ImportRunStatus>(db, vaultSettingKey(vault, IMPORT_STATUS_KEY));
}

export async function readPullRequestSettings(db: PowerLoomDb, vault: string): Promise<PullRequestSettings> {
  const stored = await readValue<Partial<PullRequestSettings>>(db, vaultSettingKey(vault, PULL_REQUESTS_KEY));

  return { ...DEFAULT_PULL_REQUEST_SETTINGS, ...stored };
}

export async function savePullRequestSettings(db: PowerLoomDb, vault: string, settings: PullRequestSettings): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, PULL_REQUESTS_KEY), settings);
}

export async function readReadSqlSettings(db: PowerLoomDb, vault: string): Promise<ReadSqlSettings> {
  const stored = await readValue<Partial<ReadSqlSettings>>(db, vaultSettingKey(vault, READ_SQL_KEY));

  return { enabled: stored?.enabled ?? false, connections: stored?.connections ?? [] };
}

export async function readDevHubSettings(db: PowerLoomDb, vault: string): Promise<DevHubSettings> {
  const stored = await readValue<Partial<DevHubSettings>>(db, vaultSettingKey(vault, DEVHUB_KEY));

  return { enabled: stored?.enabled ?? false, url: stored?.url || DEFAULT_DEVHUB_URL, token: stored?.token ?? "" };
}

export async function readReadAzureSettings(db: PowerLoomDb, vault: string): Promise<ReadAzureSettings> {
  const stored = await readValue<Partial<ReadAzureSettings>>(db, vaultSettingKey(vault, READ_AZURE_KEY));

  return { enabledKinds: stored?.enabledKinds ?? {}, resources: stored?.resources ?? [], subscription: stored?.subscription ?? "" };
}

// Null until the user signed in for this vault.
export function readAzureUserAccount(db: PowerLoomDb, vault: string): Promise<AzureUserAccount | null> {
  return readValue<AzureUserAccount>(db, vaultSettingKey(vault, AZURE_USER_KEY));
}

export async function readValue<T>(db: PowerLoomDb, key: string): Promise<T | null> {
  const rows = await db.select().from(config).where(eq(config.key, key));

  return (rows[0]?.value as T | undefined) ?? null;
}

export async function saveValue(db: PowerLoomDb, key: string, value: unknown): Promise<void> {
  await db
    .insert(config)
    .values({ key, value })
    .onConflictDoUpdate({ target: config.key, set: { value, updatedAt: new Date() } });
}
