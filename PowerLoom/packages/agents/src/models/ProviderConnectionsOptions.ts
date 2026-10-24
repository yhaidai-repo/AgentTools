export interface ProviderConnectionsOptions {
  /** The saved Claude token (Settings → AI providers), null when none is saved. */
  readClaudeToken: () => Promise<string | null>;
  /** CLAUDE_CODE_OAUTH_TOKEN as .env gave it at start-up: the fallback when Settings has none. */
  claudeEnvToken: string | null;
  /** The providers the host registered a runtime for. */
  registeredProviders: () => string[];
  /** The environment the runtimes read their login from (the runner's process env). */
  env: NodeJS.ProcessEnv;
  /** Whether Codex is signed in (its login file in PowerLoom's Codex home); null when the runner has no Codex home. */
  isCodexSignedIn: (() => Promise<boolean>) | null;
}
