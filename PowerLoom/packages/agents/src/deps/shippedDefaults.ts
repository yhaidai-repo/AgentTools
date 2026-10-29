import { createHash } from "node:crypto";
import { shippedFieldsOf, type AgentDefinition, type AgentsGlobal } from "@agenttools/config";
import { shippedPromptText } from "../prompts";

const FRAMEWORK_FILE = "_framework";

// The system agents with what this code ships recorded on them (their code-owned fields, the prompt file as a hash), so
// a start can tell which stored values an upgrade replaces.
export async function withShippedFields(agents: AgentDefinition[]): Promise<AgentDefinition[]> {
  return Promise.all(agents.map(async (agent) => ({ ...agent, shipped: shippedFieldsOf(agent, await promptHash(agent.id)) })));
}

// The global defaults with the shipped framework file's hash.
export async function withShippedFramework(global: AgentsGlobal): Promise<AgentsGlobal> {
  return { ...global, shippedFramework: await promptHash(FRAMEWORK_FILE) };
}

async function promptHash(name: string): Promise<string> {
  const text = await shippedPromptText(name);

  return text === null ? "" : createHash("sha256").update(text).digest("hex");
}
