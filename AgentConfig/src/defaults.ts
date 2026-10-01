import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";

// Stored values win; fields that newer defaults added (and the stored copy lacks) are filled in.
export function mergeWithDefaults(stored: Partial<AgentDefinition>, defaults: AgentDefinition): AgentDefinition {
  return {
    ...defaults,
    ...stored,
    model: { ...defaults.model, ...stored.model },
    limits: { ...defaults.limits, ...stored.limits },
    budgets: { ...defaults.budgets, ...stored.budgets },
    capabilities: { ...defaults.capabilities, ...stored.capabilities },
    options: { ...defaults.options, ...stored.options },
  };
}

export function mergeGlobal(stored: Partial<AgentsGlobal> | null, defaults: AgentsGlobal): AgentsGlobal {
  return { ...defaults, ...stored };
}

export function isPaused(global: AgentsGlobal, now = new Date()): boolean {
  return global.paused || (global.pausedUntil !== null && new Date(global.pausedUntil) > now);
}

export const FALLBACK_GLOBAL: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };
