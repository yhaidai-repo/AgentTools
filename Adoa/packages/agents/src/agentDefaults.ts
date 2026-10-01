import type { AgentDefinition, AgentsGlobal } from "@agenttools/config";

// adoa's agents with the values the user approved; AgentConfig keeps what clients saved and only fills gaps.
export const GLOBAL_DEFAULTS: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };

export const AGENT_DEFAULTS: AgentDefinition[] = [
  {
    id: "refinement",
    label: "Refinement",
    description: "Makes a prepared PBI ready for research and design: summary, scope, AC gaps, dependencies, repos, research tasks, questions.",
    enabled: true,
    schedule: "0 * * * *",
    model: { provider: "anthropic", model: "claude-sonnet-5" },
    limits: { maxTurns: 40, timeoutMinutes: 10 },
    budgets: { perRunUsd: 1, dailyUsd: 5 },
    capabilities: { webAccess: false },
    skills: ["adoa-refinement-checklist"],
    options: { batchSize: 2, maxFailures: 3 },
  },
  {
    id: "research",
    label: "Research",
    description: "Answers one research task from code and docs and writes a research result.",
    enabled: true,
    schedule: "30 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 2, dailyUsd: 5 },
    capabilities: { webAccess: false },
    skills: ["adoa-research-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 2, repoRefreshMinutes: 30 },
  },
];
