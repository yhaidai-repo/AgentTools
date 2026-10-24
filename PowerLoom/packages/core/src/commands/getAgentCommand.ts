import type { AgentDefinition } from "@agenttools/config";
import { z } from "zod";
import { loadRunningRuns } from "../agentRuns/runningRuns";
import { runRef } from "../agentRuns/vaultRuns";
import { loadAgentTotals } from "../agentStats/agentTotals";
import { spentToday } from "../agentStats/budgetUsage";
import { loadRunCounts } from "../agentStats/runCounts";
import type { Command } from "../models/Command";
import { fixedPeriodStart } from "../periods";
import { vaultInput } from "./inputs";
import { periodStats } from "./listAgentsCommand";

// The agent page's header shows the last 30 days whatever the period switch says.
const HEADER_RANGE = "30d";

const input = z.object({
  id: z.string().trim().min(1).describe("The agent's id, e.g. refinement (agent_list has them)"),
  vault: vaultInput,
});

type AgentInput = z.infer<typeof input>;

interface RunningRun {
  id: string;
  runId: number;
  taskId: string | null;
  pbiId: number | null;
  startedAt: Date;
}

interface AgentDetail extends AgentDefinition {
  dailySpentUsd: number;
  running: RunningRun[];
  last30Days: ReturnType<typeof periodStats>;
}

// One agent as its page shows it: the whole definition, what it spent today, its runs in progress and its last 30 days
// in the vault.
export const getAgentCommand: Command<AgentInput, AgentDetail> = {
  name: "agent.get",
  effect: "read",
  description: "Read one agent's definition in full (model, limits, budgets, capabilities, integrations, skills, options, prompt, what it handles, assigns and waits for) with today's spend, its runs in progress in the vault (RUN-<n> ids) and its last 30 days there.",
  input,
  async run(context, input) {
    if (!context.agents || !context.usage) {
      return { ok: false, error: "Agent definitions and usage records aren't available here." };
    }

    const agent = await context.agents.get(input.id);

    if (!agent) {
      return { ok: false, error: `No agent ${input.id}; agent.list has the ids.` };
    }

    const from = fixedPeriodStart(HEADER_RANGE, new Date());
    const running = (await loadRunningRuns(context.db, agent.id, input.vault)).map((run) => ({ id: runRef(run.id), runId: run.id, taskId: run.itemId, pbiId: run.pbiId, startedAt: run.startedAt }));
    const counts = (await loadRunCounts(context.db, from, input.vault)).get(agent.id);
    const totals = (await loadAgentTotals(context.db, context.usage, from, input.vault)).get(agent.id);

    return { ok: true, value: { ...agent, dailySpentUsd: await spentToday(context.usage, { agent: agent.id }), running, last30Days: periodStats(counts, totals) } };
  },
};
