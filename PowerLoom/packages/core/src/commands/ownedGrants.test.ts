import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { CommandContext } from "../models/CommandContext";
import { createAgentCommand } from "./createAgentCommand";
import { updateAgentCommand } from "./updateAgentCommand";

const designOwned = { key: "writeDesign", label: "Write designs", description: "", owner: "design" };
const shared = { key: "readRepos", label: "Repos", description: "" };

function agentOf(id: string, integrationSpecs: AgentDefinition["integrationSpecs"], origin: "builtin" | "user" = "builtin"): AgentDefinition {
  return {
    id, label: id, description: "", enabled: true, schedule: null, origin,
    model: { provider: "claude", model: "sonnet" }, limits: { maxTurns: 10, timeoutMinutes: 1 }, budgets: { perRunUsd: 1, dailyUsd: 1 },
    capabilities: { webAccess: false, integrations: Object.fromEntries(integrationSpecs.map((spec) => [spec.key, true])) },
    skills: [], options: {}, canAssign: [], handles: ["research"], waitFor: [], optionSpecs: [], integrationSpecs, prompt: "v1", promptVersion: 1,
  };
}

function contextOf(stored: AgentDefinition[]): CommandContext {
  return {
    skills: { names: async () => [] },
    agents: { list: async () => stored, get: async (id: string) => stored.find((agent) => agent.id === id), save: async () => undefined },
  } as unknown as CommandContext;
}

const design = agentOf("design", [shared, designOwned]);
const research = agentOf("better-research", [shared]);

describe("owned grants", () => {
  it("agent_update refuses another agent's owned key and names its owner", async () => {
    const result = await updateAgentCommand.run(contextOf([design, research]), { id: "better-research", grants: ["readRepos", "writeDesign"] });

    assert.deepEqual(result, { ok: false, error: '"writeDesign" belongs to the design agent and can\'t be granted to any other agent.' });
  });

  it("agent_create refuses an owned key and names its owner", async () => {
    const input = createAgentCommand.input.parse({ id: "my-agent", label: "Mine", prompt: "A prompt of at least twenty chars", handles: ["research"], grants: ["writeDesign"] });

    const result = await createAgentCommand.run(contextOf([design, research]), input);

    assert.deepEqual(result, { ok: false, error: '"writeDesign" belongs to the design agent and can\'t be granted to any other agent.' });
  });

  it("agent_update keeps the owner's own switch on whatever the grants say", async () => {
    let saved: AgentDefinition | undefined;
    const context = contextOf([design, research]);
    context.agents!.save = async (next) => { saved = next; };
    context.powerloom = { addPromptVersion: async (_id: string, version: number) => ({ ok: true, value: version }) } as unknown as CommandContext["powerloom"];

    const result = await updateAgentCommand.run(context, { id: "design", grants: [] });

    assert.ok(result.ok);
    assert.deepEqual(saved?.capabilities.integrations, { readRepos: false, writeDesign: true });
  });
});
