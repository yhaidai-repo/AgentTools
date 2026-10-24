import { isLinkEditable, linkKey, parseWikiLinks, replaceWikiLinks } from "@powerloom/vault";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { NoteEdit } from "./models/NoteEdit";
import type { TechWriterDraft } from "./models/TechWriterDraft";

// Links inside draft/ don't count: drafts are merged and deleted themselves.
const SKIPPED = ["draft"];

// Before the draft is deleted, every link to it points at the note that took its place (user decision 2026-10-13: the
// tech-writer relinks, no run fails on a link it left). Returns the run's edits plus the notes relinked on disk.
export async function relinkDraft(docsRoot: string, draftName: string, draft: TechWriterDraft): Promise<NoteEdit[]> {
  const home = draftHome(draft);
  const linking = (await notesLinkingDraft(docsRoot, draftName, draft.edits)).filter(isLinkEditable);

  if (!home || linking.length === 0) {
    return draft.edits;
  }

  const homeName = basename(home, ".md");
  const edited = draft.edits.map((edit) => ({ ...edit, content: replaceWikiLinks(edit.content, draftName, homeName) }));
  const onDisk = linking.filter((path) => !draft.edits.some((edit) => edit.path === path));
  const relinked = await Promise.all(onDisk.map(async (path) => ({ path, content: replaceWikiLinks(await readFile(join(docsRoot, path), "utf8"), draftName, homeName) })));

  return [...edited, ...relinked];
}

// Checked before anything is written: links the relink couldn't fix (root files, or no note took the draft's place)
// stop the run, with the notes to fix.
export async function requireNoDraftLinks(docsRoot: string, draftName: string, edits: NoteEdit[]): Promise<void> {
  if (keepsDraftName(draftName, edits)) {
    return;
  }

  const linking = await notesLinkingDraft(docsRoot, draftName, edits);

  if (linking.length > 0) {
    throw new Error(`these notes still link [[${draftName}]], which is deleted on merge, and couldn't be relinked (a root file, or no note marked takesDraftPlace): ${linking.join(", ")}`);
  }
}

// A note the run wrote outside draft/ under the draft's own name: links to that name reach it once the draft is deleted.
function keepsDraftName(draftName: string, edits: NoteEdit[]): boolean {
  return edits.some((edit) => !SKIPPED.includes(edit.path.split("/")[0]) && linkKey(basename(edit.path, ".md")) === linkKey(draftName));
}

// The marked note, or the only note the run wrote.
function draftHome(draft: TechWriterDraft): string | null {
  return draft.home ?? (draft.edits.length === 1 ? draft.edits[0].path : null);
}

// Notes that would still link the draft once it's deleted (Obsidian turns a click on such a link into an empty root
// note). The run's own edits count in their new version.
async function notesLinkingDraft(docsRoot: string, draftName: string, edits: NoteEdit[]): Promise<string[]> {
  const edited = new Map(edits.map((edit) => [edit.path, edit.content]));
  const onDisk = (await markdownFiles(docsRoot, "")).filter((path) => !edited.has(path));
  const linkingOnDisk = await filterAsync(onDisk, async (path) => linksTo(path, await readFile(join(docsRoot, path), "utf8"), draftName));
  const linkingEdits = [...edited].filter(([path, content]) => linksTo(path, content, draftName)).map(([path]) => path);

  return [...linkingOnDisk, ...linkingEdits];
}

// [[name]], [[name|label]] and [[name#heading]], outside code; Obsidian matches names case-insensitively.
function linksTo(path: string, content: string, draftName: string): boolean {
  return parseWikiLinks(path, content).some((link) => linkKey(link.target) === linkKey(draftName));
}

async function markdownFiles(root: string, folder: string): Promise<string[]> {
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  const visible = entries.filter((entry) => !entry.name.startsWith(".") && !(folder === "" && SKIPPED.includes(entry.name)));
  const files = visible.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => join(folder, entry.name).replaceAll("\\", "/"));
  const nested = await Promise.all(visible.filter((entry) => entry.isDirectory()).map((entry) => markdownFiles(root, join(folder, entry.name))));

  return [...files, ...nested.flat()];
}

async function filterAsync<T>(items: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const kept = await Promise.all(items.map(predicate));

  return items.filter((_, index) => kept[index]);
}
