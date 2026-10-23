import type { UsageRecord } from "@agenttools/usage";
import { z } from "zod";
import { conversationChain, conversationCostUsd } from "../agentRuns/conversationChain";
import { loadRun, loadRunUsage, tokensOf } from "../agentRuns/runDetail";
import { runRef } from "../agentRuns/vaultRuns";
import type { AgentRunRow } from "../models/AgentRunRow";
import type { Command } from "../models/Command";
import type { RunListRow } from "../models/RunListRow";
import { vaultInput } from "./inputs";

const input = z.object({
  id: z.number().int().positive().describe("The run's number, e.g. 2716 for RUN-2716"),
  vault: vaultInput,
});

type RunInput = z.infer<typeof input>;

interface RunDetail {
  id: string;
  runId: number;
  stage: string;
  pbiId: number | null;
  model: string | null;
  promptVersion: string | null;
  startedAt: Date;
  endedAt: Date | null;
  outcome: string;
  error: string | null;
  /** The first message, or the continuation note when the run continued an earlier one; cut to INPUT_CHARS. */
  input: string | null;
  inputChars: number;
  continuesRunId: string | null;
  continuedByRunId: string | null;
  /** The whole conversation this run is part of; null when it stands alone. */
  conversation: { runs: number; costUsd: number } | null;
  task: { id: string; kind: string; title: string; status: string } | null;
  usage: { costUsd: number; tokens: number; turns: number; durationMs: number } | null;
  outputs: string[];
}

// A first message carries the whole PBI context (tens of thousands of characters); a chat reads its head here and the
// PBI itself with pbi.read.
const INPUT_CHARS = 4000;

// One run as its page shows it: the header's facts, its task, its usage once ended, its outputs and its conversation.
export const getRunCommand: Command<RunInput, RunDetail> = {
  name: "run.get",
  effect: "read",
  description: "Read one agent run of a vault: agent, PBI, task, outcome and error, first message, tokens and cost once ended, the outputs it made (item ids, notes) and the runs it continued or was continued by. run.events gives its trace.",
  input,
  async run(context, input) {
    if (!context.usage) {
      return { ok: false, error: "Usage records aren't available here." };
    }

    const found = await loadRun(context.db, input.id, input.vault);

    if (!found) {
      return { ok: false, error: `${runRef(input.id)} isn't in vault ${input.vault}.` };
    }

    const chain = await conversationChain(context.db, found.run);
    const conversation = chain.length > 1 ? { runs: chain.length, costUsd: await conversationCostUsd(context.usage, chain) } : null;
    const usage = await loadRunUsage(context.usage, found.run.id);

    return { ok: true, value: detailOf(found, chain, conversation, usage) };
  },
};

function detailOf({ run, task }: Pick<RunListRow, "run" | "task">, chain: AgentRunRow[], conversation: RunDetail["conversation"], usage: UsageRecord | null): RunDetail {
  const next = chain[chain.indexOf(run) + 1];

  return {
    id: runRef(run.id),
    runId: run.id,
    stage: run.stage,
    pbiId: run.pbiId,
    model: run.model,
    promptVersion: run.promptVersion,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    outcome: run.outcome,
    error: run.error,
    input: run.input === null ? null : run.input.slice(0, INPUT_CHARS),
    inputChars: run.input?.length ?? 0,
    continuesRunId: run.continuesRunId === null ? null : runRef(run.continuesRunId),
    continuedByRunId: next ? runRef(next.id) : null,
    conversation,
    task: task ? { id: task.id, kind: task.kind, title: task.title, status: task.status } : null,
    usage: usage ? { costUsd: usage.costUsd, tokens: tokensOf(usage), turns: usage.turns, durationMs: usage.durationMs } : null,
    outputs: run.outputs ?? [],
  };
}
