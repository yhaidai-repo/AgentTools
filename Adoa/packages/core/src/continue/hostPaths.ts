import type { ContinueEnv } from "../models/ContinueEnv";

// Paths on the user's PC: the chat runs there, not in the containers.

// A note of a vault's backlog (stored paths are relative to the vault's backlog folder).
export function backlogHostPath(env: ContinueEnv, vault: string, backlogRelativePath: string): string {
  return `${backlogHostFolder(env, vault)}/${backlogRelativePath}`;
}

// The chat opens in exactly the vault's folder (user decision 2026-10-05), so that vault's own rules load.
export function chatHostFolder(env: ContinueEnv, vault: string): string {
  return `${env.folder}/${vault}`;
}

// The backlog lies outside the chat's folder, so a chat that reads backlog notes adds the vault's backlog like a repo.
export function backlogHostFolder(env: ContinueEnv, vault: string): string {
  return `${env.vault}/${vault}`;
}

export function repoHostPaths(env: ContinueEnv, repoNames: string[]): string[] {
  return repoNames.map((name) => `${env.reposRoot}/${name}`);
}

// A project folder of a vault, which is a folder of the vaults root.
export function docsProjectHostPath(env: ContinueEnv, vault: string, project: string): string {
  return `${env.folder}/${vault}/${project}`;
}

export function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}
