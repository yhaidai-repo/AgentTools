import { readVaults } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";
import { rename, stat } from "node:fs/promises";
import { join } from "node:path";

// Before vaults became accounts, adoa rendered the one backlog into `<backlog vault>/<LEGACY_BACKLOG_FOLDER>`; now each
// vault has its own folder there (user decision 2026-10-05). The one folder becomes the first vault's, once.
export async function migrateLegacyBacklog(db: AdoaDb, backlogMount: string, legacyFolder: string): Promise<string | null> {
  const [first] = await readVaults(db);
  const legacy = join(backlogMount, legacyFolder);

  if (!first || first.name === legacyFolder || !(await isDirectory(legacy)) || (await isDirectory(join(backlogMount, first.name)))) {
    return null;
  }

  await rename(legacy, join(backlogMount, first.name));

  return `backlog folder ${legacyFolder}/ moved to ${first.name}/`;
}

async function isDirectory(path: string): Promise<boolean> {
  const entry = await stat(path).catch(() => null);

  return entry?.isDirectory() ?? false;
}
