const SLUG_MAX = 40;

export const BACKLOG_INDEX_PATH = "backlog-index.md";
export const PBI_TEMPLATE_PATH = "_templates/pbi.md";

export function pbiNoteName(adoId: number): string {
  return `PBI-${adoId}`;
}

// The folder keeps the slug of the first title; callers reuse the stored path so a rename doesn't orphan notes.
export function pbiNotePath(adoId: number, title: string): string {
  const name = pbiNoteName(adoId);

  return `pbi/${name}-${slugify(title)}/${name}.md`;
}

export function refinementNoteName(adoId: number): string {
  return `${pbiNoteName(adoId)}-refinement`;
}

export function designNoteName(adoId: number): string {
  return `${pbiNoteName(adoId)}-design`;
}

export function implementNoteName(adoId: number): string {
  return `${pbiNoteName(adoId)}-implement`;
}

// Refinement, design, implement and item notes live in the PBI's folder, next to its note.
export function refinementNotePath(pbiNotePath: string, adoId: number): string {
  return `${folderOf(pbiNotePath)}/${refinementNoteName(adoId)}.md`;
}

export function designNotePath(pbiNotePath: string, adoId: number): string {
  return `${folderOf(pbiNotePath)}/${designNoteName(adoId)}.md`;
}

export function implementNotePath(pbiNotePath: string, adoId: number): string {
  return `${folderOf(pbiNotePath)}/${implementNoteName(adoId)}.md`;
}

// A note of the PBI's folder as seen from that folder (e.g. `questions/Q-1-001.md`), for notes that list their siblings.
export function pathInPbiFolder(pbiNotePath: string, path: string): string {
  const folder = `${folderOf(pbiNotePath)}/`;

  return path.startsWith(folder) ? path.slice(folder.length) : path;
}

// A PR's review note (Continue with Claude); reviews have no PBI folder.
export function reviewNoteName(prId: number): string {
  return `PR-${prId}`;
}

export function reviewNotePath(prId: number): string {
  return `reviews/${reviewNoteName(prId)}.md`;
}

const ITEM_FOLDERS: Record<string, string> = { question: "questions", "research-result": "research" };

export function itemNotePath(pbiNotePath: string, itemId: string, kind: string): string {
  return `${folderOf(pbiNotePath)}/${ITEM_FOLDERS[kind] ?? "tasks"}/${itemId}.md`;
}

// Uploads keep their name, prefixed with the attachment id so two files of the same name never clash.
export function attachmentFileName(ref: string, fileName: string): string {
  return `${ref}-${fileName.replaceAll(/[^A-Za-z0-9._-]+/g, "-")}`;
}

export function attachmentPath(pbiNotePath: string, ref: string, fileName: string): string {
  return `${folderOf(pbiNotePath)}/attachments/${attachmentFileName(ref, fileName)}`;
}

function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return slug.slice(0, SLUG_MAX).replace(/-+$/, "") || "untitled";
}
