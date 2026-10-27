import { z } from "zod";
import { loadRunList } from "../agentRuns/runList";
import { tokensOf } from "../agentRuns/runDetail";
import { RUN_OUTCOME_GROUP_KEYS, outcomeGroupOf } from "../agentRuns/runOutcomes";
import { runRef } from "../agentRuns/vaultRuns";
import type { Command } from "../models/Command";
import type { RunListRow } from "../models/RunListRow";
import { periodStart } from "../periods";
import { limitInput, periodInput, vaultInput } from "./inputs";

const input = z.object({
  vault: vaultInput,
  period: periodInput,
  agent: z.string().trim().min(1).optional().describe("Only this agent's runs (its id, e.g. refinement)"),
  outcome: z.enum(RUN_OUTCOME_GROUP_KEYS).optional().describe("Only runs of this outcome group, as the Runs tab's pills: running, failed or succeeded (success, no-op, budget stop)"),
  limit: limitInput(200, 50),
});

type RunListInput = z.infer<typeof input>;

interface RunListEntry {
  id: string;
  runId: number;
  stage: string;
  pbiId: number | null;
  taskId: string | null;
  taskTitle: string | null;
  startedAt: Date;
  endedAt: Date | null;
  outcome: string;
  error: string | null;
  costUsd: number | null;
  accountingComplete?: boolean;
  tokens: number | null;
  continuesRunId: string | null;
}

// The Runs tab as a list: the vault's agent runs in the period, newest first, filtered like the page.
export const listRunsCommand: Command<RunListInput, RunListEntry[]> = {
  name: "run.list",
  effect: "read",
  description: "List a vault's agent runs in a period, newest first: id (RUN-<n>), agent (stage), PBI, task, outcome, error, cost and tokens once ended. Filter by agent id and outcome group. Pass an id to run_get or run_events.",
  input,
  async run(context, input) {
    if (!context.usage) {
      return { ok: false, error: "Usage records aren't available here." };
    }

    const from = await periodStart(context.db, input.period, input.vault);
    const rows = await loadRunList(context.db, context.usage, { agent: input.agent ?? "", range: input.period, outcome: "" }, from, input.vault);
    const shown = rows.filter((row) => !input.outcome || outcomeGroupOf(row.run.outcome) === input.outcome);

    return { ok: true, value: shown.slice(0, input.limit).map(entryOf) };
  },
};

function entryOf({ run, task, usage }: RunListRow): RunListEntry {
  return {
    id: runRef(run.id),
    runId: run.id,
    stage: run.stage,
    pbiId: run.pbiId,
    taskId: task?.id ?? run.itemId,
    taskTitle: task?.title ?? null,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    outcome: run.outcome,
    error: run.error,
    costUsd: usage?.accountingComplete === false ? null : usage?.costUsd ?? null,
    accountingComplete: usage?.accountingComplete,
    tokens: usage ? tokensOf(usage) : null,
    continuesRunId: run.continuesRunId === null ? null : runRef(run.continuesRunId),
  };
}
