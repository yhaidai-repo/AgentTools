import type { PowerLoomDb } from "@powerloom/db";
import { readClaudeToken } from "@powerloom/core";

const CLAUDE_PROVIDER = "anthropic";
const TOKEN_VARIABLE = "CLAUDE_CODE_OAUTH_TOKEN";
// The names Settings → AI providers shows; a provider without one is shown by its id.
const PROVIDER_LABELS: Record<string, string> = { [CLAUDE_PROVIDER]: "Claude" };

export interface ProviderConnectionsOptions {
  /** The saved Claude token (Settings → AI providers), null when none is saved. */
  readClaudeToken: () => Promise<string | null>;
  /** CLAUDE_CODE_OAUTH_TOKEN as .env gave it at start-up: the fallback when Settings has none. */
  claudeEnvToken: string | null;
  /** The providers the host registered a runtime for. */
  registeredProviders: () => string[];
  /** The environment the runtimes read their login from (the runner's process env). */
  env: NodeJS.ProcessEnv;
}

// Whether an agent's provider is connected, checked right before its run (Settings → AI providers). For Claude it also
// sets the runner's env to the token the run must use: the saved one, else the .env fallback. The runner runs one task
// at a time, so the process env is the run's.
export class ProviderConnections {
  constructor(private readonly options: ProviderConnectionsOptions) {}

  static forRunner(db: PowerLoomDb, registeredProviders: () => string[], env: NodeJS.ProcessEnv = process.env): ProviderConnections {
    return new ProviderConnections({ readClaudeToken: () => readClaudeToken(db), claudeEnvToken: env[TOKEN_VARIABLE] || null, registeredProviders, env });
  }

  /** Null when the provider is connected (and its login is set for the run), else what the user must do. */
  async prepare(provider: string): Promise<string | null> {
    if (provider === CLAUDE_PROVIDER) {
      return this.prepareClaude();
    }

    return this.options.registeredProviders().includes(provider) ? null : connectMessage(provider);
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
