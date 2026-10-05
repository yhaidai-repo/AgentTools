// PC paths a "continue with agent" chat needs; null fields mean the caller didn't configure them.
export interface ContinueEnv {
  launcher: string; // chat launcher id, e.g. "claude-desktop"
  folder: string; // the chat's folder: the vaults root
  reposRoot: string;
  vault: string; // adoa's backlog vault
  backlogFolder: string;
}
