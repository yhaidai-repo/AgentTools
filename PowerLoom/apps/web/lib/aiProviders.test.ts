import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectedModels, type ProviderStatus } from "./aiProviders";

const catalog = [
  { provider: "anthropic", model: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { provider: "openai-codex", model: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
];

function status(provider: string, connected: boolean): ProviderStatus {
  return { provider, label: provider, connected, source: connected ? "settings" : null };
}

describe("the Agents page's model choices", () => {
  it("offer only connected providers' models", () => {
    assert.deepEqual(connectedModels(catalog, [status("anthropic", true), status("openai-codex", false)]).map((entry) => entry.model), ["claude-opus-5-5"]);
  });

  it("leave out a provider Settings doesn't know", () => {
    assert.deepEqual(connectedModels(catalog, [status("anthropic", true)]).map((entry) => entry.model), ["claude-opus-5-5"]);
  });

  it("offer nothing while no provider is connected, and every model while PowerLoom can't say", () => {
    assert.deepEqual(connectedModels(catalog, [status("anthropic", false)]), []);
    assert.deepEqual(connectedModels(catalog, null), catalog);
  });
});
