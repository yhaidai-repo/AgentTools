import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { providerOfModel, withModelProvider } from "./modelProvider";

const CATALOG = [
  { provider: "anthropic", model: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { provider: "openai-codex", model: "gpt-6.1-sol", label: "GPT-6.1 Sol (Codex)" },
];

describe("providerOfModel", () => {
  it("takes the provider from the chosen model, whatever was given", () => {
    assert.equal(providerOfModel("gpt-6.1-sol", "anthropic", CATALOG), "openai-codex");
    assert.equal(providerOfModel("claude-opus-5-5", "openai-codex", CATALOG), "anthropic");
  });

  it("keeps the given provider for a model the catalog doesn't list", () => {
    assert.equal(providerOfModel("claude-custom", "anthropic", CATALOG), "anthropic");
  });

  it("fixes a Codex model saved with the wrong provider, from the bundled catalog", () => {
    assert.deepEqual(withModelProvider({ provider: "anthropic", model: "gpt-6.1-sol", effort: "high" }), { provider: "openai-codex", model: "gpt-6.1-sol", effort: "high" });
  });
});
