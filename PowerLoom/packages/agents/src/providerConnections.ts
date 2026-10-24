import type { PowerLoomDb } from "@powerloom/db";
import { readClaudeToken } from "@powerloom/core";
import { CodexHome } from "./codex/CodexHome";
import type { ProviderConnectionsOptions } from "./models/ProviderConnectionsOptions";

const CLAUDE_PROVIDER = "anthropic";
const CODEX_PROVIDER = "openai-codex";
const TOKEN_VARIABLE = "CLAUDE_CODE_OAUTH_TOKEN";
// The names Settings → AI providers shows; a provider without one is shown by its id.
const PROVIDER_LABELS: Record<string, string> = { [CLAUDE_PROVIDER]: "Claude", [CODEX_PROVIDER]: "Codex" };

// Whether an agent's provider is connected, checked right before its run (Settings → AI providers). For Claude it also
// sets the runner's env to the token the run must use: the saved one, else the .env fallback. The runner runs one task
// at a time, so the process env is the run's.
export class ProviderConnections {
  constructor(private readonly options: ProviderConnectionsOptions) {}

  static forRunner(db: PowerLoomDb, registeredProviders: () => string[], env: NodeJS.ProcessEnv = process.env): ProviderConnections {
    const codexHome = env.CODEX_HOME ? new CodexHome(env.CODEX_HOME) : null;

    return new ProviderConnections({ readClaudeToken: () => readClaudeToken(db), claudeEnvToken: env[TOKEN_VARIABLE] || null, registeredProviders, env, isCodexSignedIn: codexHome ? () => codexHome.isSignedIn() : null });
  }

  /** Null when the provider is connected (and its login is set for the run), else what the user must do. */
  async prepare(provider: string): Promise<string | null> {
    if (!this.options.registeredProviders().includes(provider)) {
      return connectMessage(provider);
    }

    if (provider === CLAUDE_PROVIDER) {
      return this.prepareClaude();
    }

    return provider === CODEX_PROVIDER ? this.prepareCodex() : null;
  }

  private async prepareCodex(): Promise<string | null> {
    const isSignedIn = (await this.options.isCodexSignedIn?.()) ?? false;

    return isSignedIn ? null : connectMessage(CODEX_PROVIDER);
  }

  private async prepareClaude(): Promise<string | null> {
    const token = (await this.options.readClaudeToken()) ?? this.options.claudeEnvToken;

    if (!token) {
      delete this.options.env[TOKEN_VARIABLE];

      return connectMessage(CLAUDE_PROVIDER);
    }

    this.options.env[TOKEN_VARIABLE] = token;

    return null;
  }
}

export function connectMessage(provider: string): string {
  return `Connect ${PROVIDER_LABELS[provider] ?? provider} in Settings → AI providers, then Re-run the task.`;
}
