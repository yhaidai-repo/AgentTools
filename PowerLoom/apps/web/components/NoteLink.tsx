import { obsidianLink } from "@/lib/obsidian";

// A vault's backlog note (or file), opened in Obsidian; the plain path when VAULT_PATH isn't set.
export function NoteLink({ vault, path, label }: { vault: string; path: string; label: string }) {
  const href = obsidianLink(vault, path);

  return href ? <a href={href}>{label}</a> : <span>{label} ({path})</span>;
}
