import { obsidianLink } from "@/lib/obsidian";

// A Vault note (or file), opened in Obsidian; the plain path when VAULT_PATH isn't set.
export function NoteLink({ path, label }: { path: string; label: string }) {
  const href = obsidianLink(path);

  return href ? <a href={href}>{label}</a> : <span>{label} ({path})</span>;
}
