import { basename } from "node:path";

// Opens a rendered note in Obsidian. VAULT_PATH is adoa's vault (its folder name is the vault name); notes are rendered
// into its BACKLOG_FOLDER, and their stored paths are relative to that folder.
export function obsidianLink(backlogRelativePath: string): string | null {
  const vaultPath = process.env.VAULT_PATH?.replaceAll("\\", "/").replace(/\/+$/, "");

  if (!vaultPath) {
    return null;
  }

  const file = [backlogFolder(), backlogRelativePath].filter(Boolean).join("/");

  return `obsidian://open?vault=${encodeURIComponent(basename(vaultPath))}&file=${encodeURIComponent(file)}`;
}

export function backlogFolder(): string {
  return (process.env.BACKLOG_FOLDER ?? "backlog").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

// Opens a file of the docs vault (e.g. an agent's draft/ note); DOCS_VAULT_NAME is that vault's folder name.
export function obsidianDocsLink(docsRelativePath: string): string | null {
  const vault = process.env.DOCS_VAULT_NAME;

  return vault ? `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(docsRelativePath)}` : null;
}
