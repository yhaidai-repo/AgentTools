import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { AdoaNote } from "@/models/AdoaNote";
import type { VaultNote } from "@/models/VaultNote";

// Folders VaultUsage never tracks (its config's excludeFolders), so they aren't notes here either.
const HIDDEN_FOLDERS = [".obsidian", ".usage", ".trash"];
const ADOA_AUTHOR = /^adoa tech-writer \((RUN-(\d+)), (\d{4}-\d{2}-\d{2})\)$/;

// The docs vault the agents use, mounted read-only into the web (DOCS_ROOT); null when it isn't.
export function docsRoot(): string | null {
  return process.env.DOCS_ROOT || null;
}

export async function listVaultNotes(root: string): Promise<VaultNote[]> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => join(entry.parentPath, entry.name));
  const visible = files.map((file) => relative(root, file).replaceAll("\\", "/")).filter((path) => !path.split("/").some((part) => HIDDEN_FOLDERS.includes(part)));

  return Promise.all(visible.sort().map(async (path) => readNote(root, path)));
}

// The tech-writer's notes changed since the period's start (user decision 2026-10-02: the page lists only those, and the
// period applies), newest change first. The stamp has a day, so a note changed on the start day counts.
export function notesWrittenByAdoa(notes: VaultNote[], since: Date): AdoaNote[] {
  const sinceDay = since.toISOString().slice(0, 10);

  const written = notes.map((note) => ({ note, match: note.authors.map((author) => ADOA_AUTHOR.exec(author)).find(Boolean) })).filter((entry) => entry.match);

  return written
    .map(({ note, match }): AdoaNote => ({ path: note.path, title: note.title, runId: Number(match![2]), date: match![3], action: null, createdByRunId: null }))
    .filter((note) => note.date >= sinceDay)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.runId ?? 0) - (a.runId ?? 0));
}

async function readNote(root: string, path: string): Promise<VaultNote> {
  const text = await readFile(join(root, path), "utf8");

  return { path, title: noteTitle(text) ?? basename(path, ".md"), authors: authorsOf(text) };
}

function noteTitle(text: string): string | null {
  const title = /^title:\s*(.+?)\s*$/m.exec(frontmatter(text))?.[1];

  return title ? unquoted(title) : (/^# (.+)$/m.exec(text)?.[1] ?? null);
}

// YAML quotes wrap the whole value; a title that only ends with a quote mark (`Rule "Active Hospice…"`) keeps it.
function unquoted(value: string): string {
  const isQuoted = value.length > 1 && /^(["']).*\1$/.test(value);

  return isQuoted ? value.slice(1, -1) : value;
}

// `authors: ["Claude Code (chat, 2026-10-02)", "adoa tech-writer (RUN-36, 2026-10-02)"]`, the vault rules' format.
function authorsOf(text: string): string[] {
  const line = /^authors:\s*(\[.*\])\s*$/m.exec(frontmatter(text))?.[1];

  if (!line) {
    return [];
  }

  try {
    return (JSON.parse(line) as unknown[]).map(String);
  } catch {
    return [];
  }
}

function frontmatter(text: string): string {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
}
