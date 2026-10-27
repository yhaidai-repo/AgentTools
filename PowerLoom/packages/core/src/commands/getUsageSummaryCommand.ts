import { z } from "zod";
import { loadAgentTotals } from "../agentStats/agentTotals";
import { loadCostliestPbis } from "../agentStats/pbiCosts";
import type { AgentTotals } from "../models/AgentTotals";
import type { Command } from "../models/Command";
import type { PbiCost } from "../models/PbiCost";
import { periodStart } from "../periods";
import { periodInput, vaultInput } from "./inputs";

// The dashboard's Agents tab shows the ten PBIs the agents spent the most on.
const COSTLIEST_PBIS = 10;

const input = z.object({ vault: vaultInput, period: periodInput });

type UsageSummaryInput = z.infer<typeof input>;

interface AgentUsageEntry extends AgentTotals {
  id: string;
}

interface UsageSummary {
  from: Date;
  agents: AgentUsageEntry[];
  total: AgentTotals;
  costliestPbis: PbiCost[];
}

// What the vault's agents spent in the period (the dashboard's Agents tab): per agent, in all, and per costliest PBI.
export const getUsageSummaryCommand: Command<UsageSummaryInput, UsageSummary> = {
  name: "usage.summary",
  effect: "read",
  description: "Sum a vault's agent usage in a period: per agent the finished runs, tokens, cost and duration, the total, and the ten PBIs the agents spent the most on (pbiId, title, runs, cost, duration).",
  input,
  async run(context, input) {
    if (!context.usage) {
      return { ok: false, error: "Usage records aren't available here." };
    }

    const from = await periodStart(context.db, input.period, input.vault);
    const totals = await loadAgentTotals(context.db, context.usage, from, input.vault);
    const agents = [...totals].map(([id, usage]) => ({ id, ...usage })).sort((a, b) => b.costUsd - a.costUsd);
    const costliestPbis = await loadCostliestPbis(context.db, from, COSTLIEST_PBIS, input.vault);

    return { ok: true, value: { from, agents, total: sumOf(agents), costliestPbis } };
  },
};

function sumOf(agents: AgentTotals[]): AgentTotals {
  return agents.reduce((sum, usage) => ({ runs: sum.runs + usage.runs, tokens: sum.tokens + usage.tokens, costUsd: sum.costUsd + usage.costUsd, durationMs: sum.durationMs + usage.durationMs, accountingComplete: sum.accountingComplete !== false && usage.accountingComplete !== false }), { runs: 0, tokens: 0, costUsd: 0, durationMs: 0, accountingComplete: true });
}
