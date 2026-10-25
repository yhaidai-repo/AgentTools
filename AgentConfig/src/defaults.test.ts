import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshUserAgents } from "./defaults";
import type { AgentDefinition } from "./models/AgentDefinition";

const specs = [
  { key: "readRepos", label: "Repos", description: "" },
  { key: "readGoogleDrive", label: "Google Drive", description: "" },
];

function agent(id: string, origin: "builtin" | "user", integrations: Record<string, boolean>, integrationSpecs = specs): AgentDefinition {
  return { id, origin, capabilities: { webAccess: false, integrations }, integrationSpecs } as unknown as AgentDefinition;
}

describe("refreshUserAgents", () => {
  it("gives an agent made in the UI the current switches: a new one off, the ones it had kept, a gone one dropped", () => {
    const old = agent("my-agent", "user", { readRepos: true, retired: true }, [{ key: "readRepos", label: "Repos", description: "" }]);

    const [refreshed] = refreshUserAgents([old, agent("research", "builtin", {})], [agent("research", "builtin", {})]);

    assert.deepEqual(refreshed.integrationSpecs, specs);
    assert.deepEqual(refreshed.capabilities.integrations, { readRepos: true, readGoogleDrive: false });
  });

  it("leaves the built-in agents to their own defaults", () => {
    assert.deepEqual(refreshUserAgents([agent("research", "builtin", {})], [agent("research", "builtin", {})]), []);
  });
});
