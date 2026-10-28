import type { AgentConfigStore, AgentIntegrationSpec } from "@agenttools/config";

// The switches every agent may have; an owned one (an agent-specific output tool) belongs to its system agent only.
export function sharedSpecs(specs: AgentIntegrationSpec[]): AgentIntegrationSpec[] {
  return specs.filter((spec) => spec.owner === undefined);
}

// One message per grant that names another agent's owned switch; the agent's own is already on, so it passes.
export async function ownedGrantProblems(agents: AgentConfigStore, agentId: string, grants: string[]): Promise<string[]> {
  if (grants.length === 0) {
    return [];
  }

  const owners = await ownersByKey(agents);

  return grants
    .filter((grant) => owners.has(grant) && owners.get(grant) !== agentId)
    .map((grant) => `"${grant}" belongs to the ${owners.get(grant)} agent and can't be granted to any other agent.`);
}

async function ownersByKey(agents: AgentConfigStore): Promise<Map<string, string>> {
  const specs = (await agents.list()).flatMap((agent) => agent.integrationSpecs ?? []);

  return new Map(specs.filter((spec) => spec.owner !== undefined).map((spec) => [spec.key, spec.owner!]));
}
