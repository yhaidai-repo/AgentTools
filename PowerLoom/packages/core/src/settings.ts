import { config, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AdoSettings } from "./models/AdoSettings";
import type { ConfluenceStatus } from "./models/ConfluenceStatus";
import type { ImportRunStatus } from "./models/ImportRunStatus";
import type { ImportSettings } from "./models/ImportSettings";
import type { PullRequestSettings } from "./models/PullRequestSettings";
import type { SyncSettings } from "./models/SyncSettings";

// Settings are per vault (user decision 2026-10-05): the key is `vault:<name>:<setting>`. Confluence access is global.
const ADO_KEY = "ado";
const SYNC_KEY = "sync";
const CONFLUENCE_KEY = "confluence";
const IMPORT_KEY = "import";
const IMPORT_STATUS_KEY = "importStatus";
const PULL_REQUESTS_KEY = "pullRequests";

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  cron: "*/30 * * * *",
  maxItemsPerRun: 400,
  sprint: "current",
};

const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  cron: "*/5 * * * *",
  maxItemsPerRun: 50,
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
