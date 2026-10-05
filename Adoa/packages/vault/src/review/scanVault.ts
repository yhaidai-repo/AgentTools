import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { ScannedNote } from "../models/ScannedNote";
import { noteTitle } from "./noteText";
import { isHiddenPath } from "./protectedNotes";
import { readUsageEvents } from "./usageLog";
import { VaultIndex } from "./VaultIndex";

// Reads one vault from disk: every note with its text and mtime, the other files links may point to, and the usage log.
export async function scanVault(vaultsDir: string, vault: string): Promise<VaultIndex> {
  const root = join(vaultsDir, vault);
  const files = await visibleFiles(root);
  const notePaths = files.filter((path) => path.endsWith(".md"));
  const notes = await Promise.all(notePaths.map((path) => readNote(root, path)));

  return new VaultIndex(vault, notes, files.filter((path) => !path.endsWith(".md")), await readUsageEvents(root));
}

async function visibleFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

  return files.filter((path) => !isHiddenPath(path)).sort();
}

async function readNote(root: string, path: string): Promise<ScannedNote> {
  const fullPath = join(root, path);
  const content = await readFile(fullPath, "utf8");
  const name = basename(path, ".md");

  return { path, name, title: noteTitle(content) ?? name, mtime: (await stat(fullPath)).mtime, content };
}
