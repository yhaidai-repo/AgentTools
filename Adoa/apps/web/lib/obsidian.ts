import { basename, dirname } from "node:path";

// Opens a rendered note in Obsidian. VAULT_PATH is a folder inside an Obsidian vault
// (e.g. D:/Claude/work-projects/backlog): the vault is its parent folder.
export function obsidianLink(vaultRelativePath: string): string | null {
  const vaultPath = process.env.VAULT_PATH?.replaceAll("\\", "/").replace(/\/+$/, "");

  if (!vaultPath) {
    return null;
  }

  const vault = basename(dirname(vaultPath));
  const file = `${basename(vaultPath)}/${vaultRelativePath}`;

  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
}
