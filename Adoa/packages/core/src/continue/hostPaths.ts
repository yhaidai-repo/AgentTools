import type { ContinueEnv } from "../models/ContinueEnv";

// Paths on the user's PC: the chat runs there, not in the containers.

// A note of the backlog (stored paths are relative to BACKLOG_FOLDER).
export function backlogHostPath(env: ContinueEnv, backlogRelativePath: string): string {
  return [env.vault, env.backlogFolder, backlogRelativePath].filter(Boolean).join("/");
}

export function repoHostPaths(env: ContinueEnv, repoNames: string[]): string[] {
  return repoNames.map((name) => `${env.reposRoot}/${name}`);
}

// A project folder of the docs vault, which is a folder of the vaults root (the chat's folder).
export function docsProjectHostPath(env: ContinueEnv, docsVaultName: string, project: string): string {
  return `${env.folder}/${docsVaultName}/${project}`;
}

export function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}
