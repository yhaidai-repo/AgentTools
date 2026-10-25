// What a host (the agent-runner, the MCP server) reads from its environment to build the deps of a vault.
export interface DepsEnv {
  /** VAULTS_DIR: every vault, writable. */
  vaultsRoot: string;
  /** BACKLOG_MOUNT: PowerLoom's backlog vault; each vault's rendered backlog is a folder in it. */
  backlogMount: string;
  /** REPO_CACHE_ROOT: one cache per vault under it. */
  repoCacheRoot: string;
  docsExclude: string[];
  skillFolders: string[];
  powerloomUrl: string;
  /** Where the `az` shim asks for Azure tokens: this host's own /azure/token route. */
  azureTokenUrl: string;
  /** The bearer secret the `az` shim sends to that route: made at each start, and only the Azure MCP servers' env has it. */
  azureTokenSecret: string;
  /** CONFLUENCE_SITE; null = no search tool. */
  confluenceSite: string | null;
  /** VAULT_CAPTURE_HOME; unset = no vault_capture tool. */
  captureHome: string | undefined;
}
