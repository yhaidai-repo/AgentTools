// PC paths a "continue with agent" chat needs; null fields mean the caller didn't configure them.
export interface ContinueEnv {
  launcher: string; // chat launcher id, e.g. "claude-desktop"
  folder: string; // the vaults root; the chat opens in the docs vault's folder under it
  reposRoot: string;
  vault: string; // adoa's backlog vault, with a folder per vault
  agentTools: string | null; // the folder with VaultUsage and VaultCapture (AGENTTOOLS_PATH); null = vaults can't be configured
}
