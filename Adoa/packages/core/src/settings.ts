import { config, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { AdoSettings } from "./models/AdoSettings";
import type { ConfluenceStatus } from "./models/ConfluenceStatus";
import type { SyncSettings } from "./models/SyncSettings";

const ADO_KEY = "ado";
const SYNC_KEY = "sync";
const CONFLUENCE_KEY = "confluence";

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  cron: "*/30 * * * *",
  maxItemsPerRun: 400,
  sprint: "current",
  states: ["New", "Ready for Dev"],
};

export async function readAdoSettings(db: AdoaDb): Promise<AdoSettings | null> {
  return readValue<AdoSettings>(db, ADO_KEY);
}

export async function saveAdoSettings(db: AdoaDb, settings: AdoSettings): Promise<void> {
  await saveValue(db, ADO_KEY, settings);
}

export async function readSyncSettings(db: AdoaDb): Promise<SyncSettings> {
  const stored = await readValue<Partial<SyncSettings>>(db, SYNC_KEY);

  return { ...DEFAULT_SYNC_SETTINGS, ...stored };
}

export async function saveSyncSettings(db: AdoaDb, settings: SyncSettings): Promise<void> {
  await saveValue(db, SYNC_KEY, settings);
}

// Sync pulls only the PBIs assigned to `user`, so it is required.
export function isAdoConfigured(settings: AdoSettings | null): settings is AdoSettings {
  return !!settings && [settings.orgUrl, settings.project, settings.team, settings.user].every(Boolean);
}

export async function saveConfluenceStatus(db: AdoaDb, status: ConfluenceStatus): Promise<void> {
  await saveValue(db, CONFLUENCE_KEY, status);
}

// Null until a worker has started with this build.
export async function readConfluenceStatus(db: AdoaDb): Promise<ConfluenceStatus | null> {
  return readValue<ConfluenceStatus>(db, CONFLUENCE_KEY);
}

async function readValue<T>(db: AdoaDb, key: string): Promise<T | null> {
  const rows = await db.select().from(config).where(eq(config.key, key));

  return (rows[0]?.value as T | undefined) ?? null;
}

async function saveValue(db: AdoaDb, key: string, value: object): Promise<void> {
  await db
    .insert(config)
    .values({ key, value })
    .onConflictDoUpdate({ target: config.key, set: { value, updatedAt: new Date() } });
}
