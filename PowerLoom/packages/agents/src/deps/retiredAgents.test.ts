import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import { disableRetiredAgents } from "./retiredAgents";

function storeWith(agents: Partial<AgentDefinition>[]) {
  const saved: AgentDefinition[] = [];
  const store = {
    get: async (id: string) => (agents.find((agent) => agent.id === id) as AgentDefinition | undefined) ?? null,
    save: async (agent: AgentDefinition) => { saved.push(agent); },
  };

  return { store, saved };
}

describe("disableRetiredAgents", () => {
  it("switches a stored retired agent off and lets it take no task type", async () => {
    const { store, saved } = storeWith([{ id: "design", enabled: true, handles: ["design"] }]);

    await disableRetiredAgents(store, ["design"]);

    assert.deepEqual(saved.map((agent) => [agent.id, agent.enabled, agent.handles]), [["design", false, []]]);
  });

  it("leaves a store without it, or with it already off, as it is", async () => {
    const { store, saved } = storeWith([{ id: "design", enabled: false, handles: [] }]);

    await disableRetiredAgents(store, ["design", "gone"]);

    assert.deepEqual(saved, []);
  });
});
