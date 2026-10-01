import { posix } from "node:path";

// Folders of the docs vault the tech-writer never writes: the rendered backlog (adoa's own output) and the drafts it merges.
const PROTECTED_FOLDERS = ["backlog", "draft"];

// Why the tech-writer may not write this path (null = it may): a Markdown note inside a project folder of the docs vault,
// never a root file (AGENTS.md, index…), never backlog/ or draft/, never outside the vault.
export function notePathProblem(path: string): string | null {
  const normalized = posix.normalize(path.replaceAll("\\", "/"));
  const [folder, ...rest] = normalized.split("/");

  if (normalized.startsWith("/") || normalized.startsWith("..") || !normalized.endsWith(".md")) {
    return `"${path}" must be a .md path inside the docs vault, relative to its root (e.g. pvs/feature/note.md).`;
  }

  if (rest.length === 0) {
    return `"${path}" is a root file of the vault; write notes inside a project folder.`;
  }

  return PROTECTED_FOLDERS.includes(folder) ? `"${path}" is in ${folder}/, which the tech-writer never writes.` : null;
}

export function normalizeNotePath(path: string): string {
  return posix.normalize(path.replaceAll("\\", "/"));
}
