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

// Refinement and item notes live in the PBI's folder, next to its note.
export function refinementNotePath(pbiNotePath: string, adoId: number): string {
  return `${folderOf(pbiNotePath)}/${refinementNoteName(adoId)}.md`;
}

const ITEM_FOLDERS: Record<string, string> = { question: "questions", "research-result": "research" };

export function itemNotePath(pbiNotePath: string, itemId: string, kind: string): string {
  return `${folderOf(pbiNotePath)}/${ITEM_FOLDERS[kind] ?? "tasks"}/${itemId}.md`;
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
