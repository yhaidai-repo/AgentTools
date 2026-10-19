import { agentRun } from "@powerloom/db";
import type { StoredTraceEvent } from "@agenttools/usage";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";

// A guard only: a task's chain ends at its agent's maxFailures or a budget stop long before this.
const MAX_CHAIN = 20;

// The trace of a run and of the runs whose conversation it continued, oldest first: what the conversation did, e.g.
// the docs and pages it read, whichever run read them.
export async function conversationTrace(deps: AgentDeps, runId: number): Promise<StoredTraceEvent[]> {
  const runIds = await conversationRunIds(deps, runId);
  const traces = await Promise.all(runIds.map((id) => deps.usageStore.trace(String(id))));

  return traces.flat();
}

async function conversationRunIds(deps: AgentDeps, runId: number): Promise<number[]> {
  const ids: number[] = [];
  let id: number | null = runId;

  while (id !== null && ids.length < MAX_CHAIN) {
    const [run] = await deps.db.select({ continuesRunId: agentRun.continuesRunId }).from(agentRun).where(eq(agentRun.id, id));

    ids.unshift(id);
    id = run?.continuesRunId ?? null;
  }

  return ids;
}
