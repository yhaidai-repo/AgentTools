import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";

// Stored values win; fields that newer defaults added (and the stored copy lacks) are filled in.
// Option and integration specs always come from the defaults (the code); values the code no longer declares are dropped.
export function mergeWithDefaults(stored: Partial<AgentDefinition>, defaults: AgentDefinition): AgentDefinition {
  const options = { ...defaults.options, ...stored.options };
  const declared = new Set(defaults.optionSpecs.map((spec) => spec.key));
  const integrations = { ...defaults.capabilities.integrations, ...stored.capabilities?.integrations };
  const offered = new Set(defaults.integrationSpecs.map((spec) => spec.key));

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
    integrationSpecs: defaults.integrationSpecs,
  };
}

export function mergeGlobal(stored: Partial<AgentsGlobal> | null, defaults: AgentsGlobal): AgentsGlobal {
  return { ...defaults, ...stored };
}

export function isPaused(global: AgentsGlobal, now = new Date()): boolean {
  return global.paused || (global.pausedUntil !== null && new Date(global.pausedUntil) > now);
}

export const FALLBACK_GLOBAL: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };
