import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NoteEdit } from "./models/NoteEdit";

// Folders whose links don't count: the draft folder itself, and the app-rendered backlog (agents never write there).
const SKIPPED = ["draft", "backlog"];

// Notes that would still link the draft once it's deleted (Obsidian turns a click on such a link into an empty root
// note). The run's own edits count in their new version.
export async function notesLinkingDraft(docsRoot: string, draftName: string, edits: NoteEdit[]): Promise<string[]> {
  const pattern = linkPattern(draftName);
  const edited = new Map(edits.map((edit) => [edit.path, edit.content]));
  const onDisk = (await markdownFiles(docsRoot, "")).filter((path) => !edited.has(path));
  const linkingOnDisk = await filterAsync(onDisk, async (path) => pattern.test(await readFile(join(docsRoot, path), "utf8")));
  const linkingEdits = [...edited].filter(([, content]) => pattern.test(content)).map(([path]) => path);

  return [...linkingOnDisk, ...linkingEdits];
}

// [[name]], [[name|label]] and [[name#heading]]; Obsidian matches names case-insensitively.
function linkPattern(draftName: string): RegExp {
  const escaped = draftName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(String.raw`\[\[${escaped}(\.md)?([|#][^\]]*)?\]\]`, "i");
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

// Checked before anything is written: a run that would leave links to the deleted draft fails, with the notes to fix.
export async function requireNoDraftLinks(docsRoot: string, draftName: string, edits: NoteEdit[]): Promise<void> {
  const linking = await notesLinkingDraft(docsRoot, draftName, edits);

  if (linking.length > 0) {
    throw new Error(`these notes still link [[${draftName}]], which is deleted on merge; point them at the merged note: ${linking.join(", ")}`);
  }
}
