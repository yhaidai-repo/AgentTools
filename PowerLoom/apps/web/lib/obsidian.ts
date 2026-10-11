import { basename } from "node:path";

// Opens a rendered note in Obsidian. VAULT_PATH is PowerLoom's backlog vault (its folder name is the vault name); each vault's
// notes are rendered into its own folder there, and their stored paths are relative to that folder.
export function obsidianLink(vault: string, backlogRelativePath: string): string | null {
  const vaultPath = vaultHostPath();

  if (!vaultPath) {
    return null;
  }

  const file = `${vault}/${backlogRelativePath}`;

  return `obsidian://open?vault=${encodeURIComponent(basename(vaultPath))}&file=${encodeURIComponent(file)}`;
}

// PowerLoom's vault on the PC (the containers see it as /vault), with forward slashes.
export function vaultHostPath(): string | null {
  return process.env.VAULT_PATH?.replaceAll("\\", "/").replace(/\/+$/, "") || null;
}

// The vaults root on the PC (the containers see it as /vaults), with forward slashes.
export function vaultsHostRoot(): string | null {
  return process.env.CONTINUE_FOLDER?.trim().replaceAll("\\", "/").replace(/\/+$/, "") || null;
}

// Opens a file of a vault (its folder name is the vault's name in Obsidian), e.g. an agent's draft/ note.
export function obsidianDocsLink(docsRelativePath: string, vault: string): string | null {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(docsRelativePath)}`;
}
