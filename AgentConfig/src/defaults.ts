import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";
import type { SystemAgentRefresh } from "./models/SystemAgentRefresh";
import { codeOwnedFields, replacedFields, shippedFieldsOf } from "./shippedFields";

// A system agent's stored copy merged with the code: the user's settings come from the stored copy, the code-owned
// fields from the code as shippedFields decides. shippedSkillNames: every skill the system agents ship, which tells a
// user's own skill from a shipped one on a copy stored before the shipped record.
export function mergeWithDefaults(stored: Partial<AgentDefinition>, defaults: AgentDefinition, shippedSkillNames: ReadonlySet<string> = new Set()): AgentDefinition {
  return refreshSystemAgent(stored, defaults, shippedSkillNames).agent;
}

export function refreshSystemAgent(stored: Partial<AgentDefinition>, defaults: AgentDefinition, shippedSkillNames: ReadonlySet<string>, now = new Date()): SystemAgentRefresh {
  const merged = { ...userSettings(stored, defaults), ...codeOwnedFields(stored, defaults, shippedSkillNames) } as AgentDefinition;
  const replaced = replacedFields(stored, merged);
  const shipped = defaults.shipped ?? shippedFieldsOf(defaults, "");
  const note = replaced.length > 0 ? { fields: replaced, at: now.toISOString() } : stored.shipped?.note;

  return { agent: { ...merged, shipped: note ? { ...shipped, note } : shipped }, replaced };
}

// What the user sets: the switch, schedule, model, limits, budgets, options and integrations persist; fields newer
// defaults added are filled in. Option and integration specs and the built-in tool grants always come from the code;
// values the code no longer declares are dropped.
function userSettings(stored: Partial<AgentDefinition>, defaults: AgentDefinition): AgentDefinition {
  const options = { ...defaults.options, ...stored.options };
  const declared = new Set(defaults.optionSpecs.map((spec) => spec.key));
  const integrationSpecs = specsOfAgent(defaults.id, defaults.integrationSpecs);
  const integrations = { ...defaults.capabilities.integrations, ...stored.capabilities?.integrations, ...ownedOn(integrationSpecs) };
  const offered = new Set(integrationSpecs.map((spec) => spec.key));

  return {
    ...defaults,
    enabled: stored.enabled ?? defaults.enabled,
    schedule: stored.schedule === undefined ? defaults.schedule : stored.schedule,
    model: { ...defaults.model, ...stored.model },
    limits: { ...defaults.limits, ...stored.limits },
    budgets: { ...defaults.budgets, ...stored.budgets },
    capabilities: {
      ...defaults.capabilities,
      webAccess: stored.capabilities?.webAccess ?? defaults.capabilities.webAccess,
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

// Stored values win, except the framework: when the code ships a framework file other than the one last applied
// (defaults.shippedFramework, its hash), a framework edited in Settings gives way to the file; its versions stay in the
// prompt history. Defaults without the hash (a host reading the settings) leave the framework as stored.
export function mergeGlobal(stored: Partial<AgentsGlobal> | null, defaults: AgentsGlobal, now = new Date()): AgentsGlobal {
  const merged = { ...defaults, ...stored };

  if (defaults.shippedFramework === undefined || stored?.shippedFramework === defaults.shippedFramework) {
    return merged;
  }

  const replacedAt = stored?.framework ? { frameworkReplacedAt: now.toISOString() } : {};

  return { ...merged, framework: "", frameworkVersion: 0, shippedFramework: defaults.shippedFramework, ...replacedAt };
}

export function isPaused(global: AgentsGlobal, now = new Date()): boolean {
  return global.paused || (global.pausedUntil !== null && new Date(global.pausedUntil) > now);
}

export const FALLBACK_GLOBAL: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };
