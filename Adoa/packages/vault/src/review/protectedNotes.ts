// The tech-writer owns draft/: drafts are merged and deleted there.
const DRAFT_FOLDER = "draft";

// Dot folders (.obsidian, .usage, .trash, .git) are no notes: Obsidian, VaultUsage and the trash keep them.
export function isHiddenPath(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("."));
}

// Notes the vault review never offers or removes: root files (AGENTS.md, CLAUDE.md, index.md, www-log.md), drafts, and a
// project's own `<key>/<key>-*.md` (index, registers, glossary, repos). Agents load them without a tool call, so the usage
// log never counts them (VaultUsage limits).
export function isProtectedNote(path: string): boolean {
  const parts = path.split("/");

  if (parts.length === 1 || parts[0] === DRAFT_FOLDER) {
    return true;
  }

  return parts.length === 2 && parts[1].startsWith(`${parts[0]}-`);
}

// Notes whose links the vault review may fix: all but root files (the vault's rules) and drafts (the tech-writer's).
export function isLinkEditable(path: string): boolean {
  const parts = path.split("/");

  return parts.length > 1 && parts[0] !== DRAFT_FOLDER;
}
