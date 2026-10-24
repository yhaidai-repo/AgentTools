import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schemeHealth } from "./schemeHealth";

const claude = { provider: "anthropic", label: "Claude", connected: true, source: "settings" as const };
const codex = { provider: "openai-codex", label: "Codex", connected: false, source: null };

describe("the scheme's provider and MCP colors", () => {
  it("show a connected provider as ok and an unconnected one as off, which doesn't make the parent a problem", () => {
    const health = schemeHealth(null, { providers: [claude, codex], mcpAnswers: true });

    assert.equal(health.claude, "ok");
    assert.equal(health.codex, "off");
    assert.equal(health["ai-providers"], "ok");
    assert.equal(health.mcp, "ok");
  });

  it("show the MCP server failed when it doesn't answer, and the providers off while PowerLoom can't say", () => {
    const health = schemeHealth(null, { providers: null, mcpAnswers: false });

    assert.equal(health.mcp, "failed");
    assert.equal(health["ai-providers"], "off");
  });
});
