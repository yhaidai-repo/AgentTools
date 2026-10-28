import type { AgentConfigStore } from "@agenttools/config";

// The grants that name another agent's owned switch, with that switch's owner; the agent's own is already on, so it passes.
export async function ownedGrants(agents: AgentConfigStore, agentId: string, grants: string[]): Promise<Map<string, string>> {
  if (grants.length === 0) {
    return new Map();
  }

  const owners = await ownersByKey(agents);

  return new Map(grants.filter((grant) => owners.has(grant) && owners.get(grant) !== agentId).map((grant) => [grant, owners.get(grant)!]));
}

export function ownedGrantProblems(owned: Map<string, string>): string[] {
  return [...owned].map(([grant, owner]) => `"${grant}" belongs to the ${owner} agent and can't be granted to any other agent.`);
}

async function ownersByKey(agents: AgentConfigStore): Promise<Map<string, string>> {
  const specs = (await agents.list()).flatMap((agent) => agent.integrationSpecs ?? []);

  return new Map(specs.filter((spec) => spec.owner !== undefined).map((spec) => [spec.key, spec.owner!]));
}
