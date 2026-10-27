import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { TrashEntry } from "../models/TrashEntry";
import { containedPath } from "../containedPath";

export const TRASH_FOLDER = ".trash";

// Every file in the vault's `.trash/` (where the vault review moves removed notes), newest first.
export async function listTrash(vaultRoot: string): Promise<TrashEntry[]> {
  const root = await containedPath(vaultRoot, join(vaultRoot, TRASH_FOLDER));
  if (!root) return [];
  const entries = await readdir(root, { withFileTypes: true, recursive: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  const listed = await Promise.all(files.map(async (file) => await containedPath(root, file) ? toEntry(root, file) : null));

  return listed.filter((entry): entry is TrashEntry => entry !== null).sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

async function toEntry(root: string, file: string): Promise<TrashEntry> {
  const info = await stat(file);

  return { path: relative(root, file).replaceAll("\\", "/"), sizeBytes: info.size, modifiedAt: info.mtime };
}
