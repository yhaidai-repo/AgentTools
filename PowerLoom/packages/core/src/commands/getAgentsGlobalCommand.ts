import type { AgentsGlobal } from "@agenttools/config";
import { spentToday } from "../agentStats/budgetUsage";
import { z } from "zod";
import { budgetLevel } from "../agentStats/budget";
import type { BudgetLevel } from "../models/BudgetLevel";
import type { Command } from "../models/Command";

interface AgentsGlobalView extends AgentsGlobal {
  /** All agents' spend today, every vault (the daily budget counts from 00:00 UTC). */
  spentTodayUsd: number | null;
  /** Null without a daily budget. */
  budgetLevel: BudgetLevel | null;
}

// The Settings > Agents globals: the kill switch, the pause after a rate limit, the daily budget and how full it is.
export const getAgentsGlobalCommand: Command<Record<string, never>, AgentsGlobalView> = {
  name: "agent.global",
  effect: "read",
  description: "Read the agents' global settings: paused (no new runs), pausedUntil after a provider rate limit, the daily budget for all agents together, what they spent today and whether the budget is near (warning) or over (critical).",
  input: z.object({}),
  async run(context) {
    if (!context.agents || !context.usage) {
      return { ok: false, error: "Agent definitions and usage records aren't available here." };
    }

    const global = await context.agents.getGlobal();
    const spentTodayUsd = await spentToday(context.usage);

    return { ok: true, value: { ...global, spentTodayUsd, budgetLevel: budgetLevel(spentTodayUsd, global.dailyBudgetUsd) } };
  },
};
