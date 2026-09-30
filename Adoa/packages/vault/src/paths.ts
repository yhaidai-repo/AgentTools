const SLUG_MAX = 40;

export const BACKLOG_INDEX_PATH = "backlog-index.md";

export function pbiNoteName(adoId: number): string {
  return `PBI-${adoId}`;
}

// The folder keeps the slug of the first title; callers reuse the stored path so a rename doesn't orphan notes.
export function pbiNotePath(adoId: number, title: string): string {
  const name = pbiNoteName(adoId);

  return `pbi/${name}-${slugify(title)}/${name}.md`;
}

export function sprintNoteName(iterationPath: string): string {
  return `SPR-${iterationPath.replaceAll("\\", "-").replaceAll(/[^\w.-]+/g, "-")}`;
}

export function sprintNotePath(iterationPath: string): string {
  return `sprints/${sprintNoteName(iterationPath)}.md`;
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return slug.slice(0, SLUG_MAX).replace(/-+$/, "") || "untitled";
}
