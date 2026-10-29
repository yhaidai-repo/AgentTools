import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeWithDefaults, refreshUserAgents } from "./defaults";
import type { AgentDefinition } from "./models/AgentDefinition";

const specs = [
  { key: "readRepos", label: "Repos", description: "" },
  { key: "readGoogleDrive", label: "Google Drive", description: "" },
];

const CODE_OWNED = { label: "Agent", description: "", skills: [], canAssign: [], handles: [], waitFor: [] };

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

describe("owned switches", () => {
  const owned = [
    ...specs,
    { key: "writeDesign", label: "Write designs", description: "", owner: "design" },
    { key: "writeRefinement", label: "Write refinements", description: "", owner: "refinement" },
  ];

  function defaultsOf(id: string, integrations: Record<string, boolean>): AgentDefinition {
    return { ...agent(id, "builtin", integrations, owned), ...CODE_OWNED, options: {}, optionSpecs: [], model: {}, limits: {}, budgets: {} } as unknown as AgentDefinition;
  }

  it("keeps an owned switch on for its owner and offers it to nobody else", () => {
    const design = mergeWithDefaults({}, defaultsOf("design", { readRepos: true, writeDesign: false }));

    assert.deepEqual(design.integrationSpecs.map((spec) => spec.key), ["readRepos", "readGoogleDrive", "writeDesign"]);
    assert.equal(design.capabilities.integrations.writeDesign, true);
  });

  it("ignores an owned key a stored config carries on the wrong agent", () => {
    const stored = { capabilities: { webAccess: false, integrations: { writeDesign: true, readRepos: true } } };

    const chat = mergeWithDefaults(stored, defaultsOf("chat", { readRepos: false }));

    assert.deepEqual(chat.integrationSpecs.map((spec) => spec.key), ["readRepos", "readGoogleDrive"]);
    assert.deepEqual(chat.capabilities.integrations, { readRepos: true });
  });

  it("never copies an owned switch to an agent made in the UI", () => {
    const made = agent("my-agent", "user", { readRepos: true, writeDesign: true }, specs);

    const [refreshed] = refreshUserAgents([made], [defaultsOf("design", {})]);

    assert.deepEqual(refreshed.integrationSpecs.map((spec) => spec.key), ["readRepos", "readGoogleDrive"]);
    assert.deepEqual(refreshed.capabilities.integrations, { readRepos: true, readGoogleDrive: false });
  });
});
