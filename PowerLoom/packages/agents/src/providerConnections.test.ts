import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProviderConnections } from "./providerConnections";

function connections(saved: string | null, envToken: string | null, env: NodeJS.ProcessEnv = {}, registered: string[] = ["anthropic"]): ProviderConnections {
  return new ProviderConnections({ readClaudeToken: async () => saved, claudeEnvToken: envToken, registeredProviders: () => registered, env });
}

describe("a provider's connection before a run", () => {
  it("sets the saved Claude token for the run, over the .env one", async () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CODE_OAUTH_TOKEN: "from-env" };

    assert.equal(await connections("saved", "from-env", env).prepare("anthropic"), null);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, "saved");
  });

  it("falls back to the .env token while Settings has none, also after a saved one was removed", async () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CODE_OAUTH_TOKEN: "saved-before" };

    assert.equal(await connections(null, "from-env", env).prepare("anthropic"), null);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, "from-env");
  });

  it("ends a Claude run without any token with what to do, and leaves no stale token behind", async () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CODE_OAUTH_TOKEN: "removed" };

    assert.equal(await connections(null, null, env).prepare("anthropic"), "Connect Claude in Settings → AI providers, then Re-run the task.");
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
  });

  it("refuses a provider the runner has no runtime for", async () => {
    assert.equal(await connections("saved", null).prepare("openai-codex"), "Connect openai-codex in Settings → AI providers, then Re-run the task.");
    assert.equal(await connections("saved", null, {}, ["anthropic", "openai-codex"]).prepare("openai-codex"), null);
  });

  it("keeps the start-up .env token as the fallback after a saved token was set for a run and then removed", async () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CODE_OAUTH_TOKEN: "from-env" };
    let saved: string | null = "saved";
    const runner = new ProviderConnections({ readClaudeToken: async () => saved, claudeEnvToken: "from-env", registeredProviders: () => ["anthropic"], env });

    await runner.prepare("anthropic");
    saved = null;
    await runner.prepare("anthropic");

    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, "from-env");
  });
});
