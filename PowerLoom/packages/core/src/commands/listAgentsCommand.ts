import type { AgentBudgets, AgentDefinition, ModelChoice } from "@agenttools/config";
import { z } from "zod";
import { loadAgentTotals } from "../agentStats/agentTotals";
import { spentTodayByAgent } from "../agentStats/budgetUsage";
import { loadRunCounts } from "../agentStats/runCounts";
import type { AgentTotals } from "../models/AgentTotals";
import type { Command } from "../models/Command";
import type { RunCounts } from "../models/RunCounts";
import { periodStart } from "../periods";
import { periodInput, vaultInput } from "./inputs";

const input = z.object({ vault: vaultInput, period: periodInput });

type AgentListInput = z.infer<typeof input>;

interface AgentPeriodStats {
  runs: number;
  failures: number;
  running: number;
  costUsd: number;
  tokens: number;
  durationMs: number;
  lastStartedAt: Date | null;
  lastOutcome: string | null;
}

interface AgentListEntry {
  id: string;
  label: string;
  enabled: boolean;
  schedule: string | null;
  model: ModelChoice;
  budgets: AgentBudgets;
  dailySpentUsd: number;
  period: AgentPeriodStats;
}

const NO_COUNTS: RunCounts = { runs: 0, totalRuns: 0, running: 0, failures: 0, lastStartedAt: null, lastOutcome: null };

const NO_TOTALS: AgentTotals = { runs: 0, tokens: 0, costUsd: 0, durationMs: 0 };

// The Agents overview as a list: every agent definition, what it spent today, and the vault's runs and costs in the period.
export const listAgentsCommand: Command<AgentListInput, AgentListEntry[]> = {
  name: "agent.list",
  effect: "read",
  description: "List every agent with its schedule, model, budgets, today's spend, and the vault's runs in the period: runs, failures, running, cost, tokens, duration, last run. Pass an id to agent_get or as `agent` to run_list.",
  input,
  async run(context, input) {
    if (!context.agents || !context.usage) {
      return { ok: false, error: "Agent definitions and usage records aren't available here." };
    }

    const from = await periodStart(context.db, input.period, input.vault);
    const agents = await context.agents.list();
    const counts = await loadRunCounts(context.db, from, input.vault);
    const totals = await loadAgentTotals(context.db, context.usage, from, input.vault);
    const spent = await spentTodayByAgent(context.usage, agents.map((agent) => agent.id));

    return { ok: true, value: agents.map((agent) => entryOf(agent, spent.get(agent.id) ?? 0, periodStats(counts.get(agent.id), totals.get(agent.id)))) };
  },
};

export function periodStats(counts: RunCounts | undefined, totals: AgentTotals | undefined): AgentPeriodStats {
  const { runs, failures, running, lastStartedAt, lastOutcome } = counts ?? NO_COUNTS;
  const { costUsd, tokens, durationMs } = totals ?? NO_TOTALS;

  return { runs, failures, running, costUsd, tokens, durationMs, lastStartedAt, lastOutcome };
}

function entryOf(agent: AgentDefinition, dailySpentUsd: number, period: AgentPeriodStats): AgentListEntry {
  return { id: agent.id, label: agent.label, enabled: agent.enabled, schedule: agent.schedule, model: agent.model, budgets: agent.budgets, dailySpentUsd, period };
}
