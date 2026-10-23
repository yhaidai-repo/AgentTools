import { modelCatalog, type AgentDefinition } from "@agenttools/config";
import { getAgentConfig } from "./agentConfig";

// The one grant a new agent starts with: reading the repos of its task (the runner's READ_REPOS_INTEGRATION key).
const READ_REPOS_INTEGRATION = "readRepos";
const DEFAULT_LIMITS = { maxTurns: 60, timeoutMinutes: 30 };
const DEFAULT_BUDGETS = { perRunUsd: 2, dailyUsd: 5 };

// The defaults a new agent starts from (user decision 2026-10-23: defaults and an advanced section, not a copy of
// another agent). The specs come from the agents shipped in code, which every start keeps current: the integration
// switches all agents share, and the options every agent has (the keys all of them declare).
export async function newAgentTemplate(id: string): Promise<AgentDefinition> {
  const builtins = (await getAgentConfig().list()).filter((agent) => agent.origin !== "user");
  const optionSpecs = sharedOptionSpecs(builtins);
  const options = Object.fromEntries(optionSpecs.map((spec) => [spec.key, optionDefault(builtins, spec.key, spec.min)]));
  const integrationSpecs = builtins[0]?.integrationSpecs ?? [];
  const integrations = Object.fromEntries(integrationSpecs.map((spec) => [spec.key, spec.key === READ_REPOS_INTEGRATION]));
  const model = modelCatalog()[0];

  return {
    id,
    label: id,
    description: "",
    enabled: false,
    schedule: null,
    model: { provider: model.provider, model: model.model },
    limits: DEFAULT_LIMITS,
    budgets: DEFAULT_BUDGETS,
    capabilities: { webAccess: false, integrations },
    skills: [],
    prompt: "",
    promptVersion: 0,
    options,
    optionSpecs,
    integrationSpecs,
    canAssign: [],
    handles: [],
    waitFor: [],
    origin: "user",
  };
}

// The keys every agent with options declares; an agent without any (the MCP chat) says nothing about them.
function sharedOptionSpecs(builtins: AgentDefinition[]): AgentDefinition["optionSpecs"] {
  const [first, ...rest] = builtins.filter((agent) => agent.optionSpecs.length > 0);

  if (!first) {
    return [];
  }

  return first.optionSpecs.filter((spec) => rest.every((agent) => agent.optionSpecs.some((other) => other.key === spec.key)));
}

// The most common value among the agents shipped in code, else the range's minimum.
function optionDefault(builtins: AgentDefinition[], key: string, fallback: number): number {
  const values = builtins.map((agent) => agent.options[key]).filter((value): value is number => typeof value === "number");
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}
