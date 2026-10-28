import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";

// Stored values win; fields that newer defaults added (and the stored copy lacks) are filled in.
// Option and integration specs always come from the defaults (the code); values the code no longer declares are dropped.
export function mergeWithDefaults(stored: Partial<AgentDefinition>, defaults: AgentDefinition): AgentDefinition {
  const options = { ...defaults.options, ...stored.options };
  const declared = new Set(defaults.optionSpecs.map((spec) => spec.key));
  const integrationSpecs = specsOfAgent(defaults.id, defaults.integrationSpecs);
  const integrations = { ...defaults.capabilities.integrations, ...stored.capabilities?.integrations, ...ownedOn(integrationSpecs) };
  const offered = new Set(integrationSpecs.map((spec) => spec.key));

  return {
    ...defaults,
    ...stored,
    model: { ...defaults.model, ...stored.model },
    limits: { ...defaults.limits, ...stored.limits },
    budgets: { ...defaults.budgets, ...stored.budgets },
    capabilities: {
      ...defaults.capabilities,
      ...stored.capabilities,
      integrations: Object.fromEntries(Object.entries(integrations).filter(([key]) => offered.has(key))),
    },
    options: Object.fromEntries(Object.entries(options).filter(([key]) => declared.has(key))),
    optionSpecs: defaults.optionSpecs,
    integrationSpecs,
  };
}

// An owned switch (user decision 2026-10-28) belongs to one system agent: no other agent is offered it, and what a stored
// config carries for it elsewhere is dropped on read.
function specsOfAgent(agentId: string, specs: AgentDefinition["integrationSpecs"]): AgentDefinition["integrationSpecs"] {
  return specs.filter((spec) => spec.owner === undefined || spec.owner === agentId);
}

// The switches every agent may have; an owned one (an agent-specific output tool) belongs to its system agent only.
export function sharedSpecs(specs: AgentDefinition["integrationSpecs"]): AgentDefinition["integrationSpecs"] {
  return specs.filter((spec) => spec.owner === undefined);
}

function ownedOn(specs: AgentDefinition["integrationSpecs"]): Record<string, boolean> {
  return Object.fromEntries(specs.filter((spec) => spec.owner !== undefined).map((spec) => [spec.key, true]));
}

// Agents made in the UI copied the shared integration switches when they were made; every start brings them the
// current ones from the agents shipped in code (user request 2026-10-25: an older agent needs a newer switch). A new
// switch starts off; every switch already set keeps its value; one the code no longer offers goes. Owned switches are
// never copied.
export function refreshUserAgents(stored: AgentDefinition[], builtins: AgentDefinition[]): AgentDefinition[] {
  const specs = builtins.find((agent) => agent.integrationSpecs.length > 0)?.integrationSpecs;

  return specs ? stored.filter((agent) => agent.origin === "user").map((agent) => withSwitches(agent, sharedSpecs(specs))) : [];
}

function withSwitches(agent: AgentDefinition, specs: AgentDefinition["integrationSpecs"]): AgentDefinition {
  const offered = new Set(specs.map((spec) => spec.key));
  const integrations = { ...Object.fromEntries(specs.map((spec) => [spec.key, false])), ...agent.capabilities.integrations };

  return {
    ...agent,
    integrationSpecs: specs,
    capabilities: { ...agent.capabilities, integrations: Object.fromEntries(Object.entries(integrations).filter(([key]) => offered.has(key))) },
  };
}

export function mergeGlobal(stored: Partial<AgentsGlobal> | null, defaults: AgentsGlobal): AgentsGlobal {
  return { ...defaults, ...stored };
}

export function isPaused(global: AgentsGlobal, now = new Date()): boolean {
  return global.paused || (global.pausedUntil !== null && new Date(global.pausedUntil) > now);
}

export const FALLBACK_GLOBAL: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };
