import type { UsageStore } from "@agenttools/usage";
import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentRunRow } from "../models/AgentRunRow";

// A guard only: a task's chain ends at its agent's maxFailures or a budget stop long before this.
const MAX_CHAIN = 50;

// The runs of one conversation, oldest first: the runs this one continued, itself, and the runs that continued it
// (user decision 2026-10-19: links both ways and what the whole conversation cost).
export async function conversationChain(db: PowerLoomDb, run: AgentRunRow): Promise<AgentRunRow[]> {
  return [...(await earlierRuns(db, run)), run, ...(await laterRuns(db, run))];
}

export async function conversationCostUsd(usage: UsageStore, chain: AgentRunRow[]): Promise<number> {
  const records = await Promise.all(chain.map((run) => usage.records({ from: new Date(0), match: { run: String(run.id) } }, 1)));

  return records.reduce((sum, [record]) => sum + (record?.costUsd ?? 0), 0);
}

async function earlierRuns(db: PowerLoomDb, run: AgentRunRow): Promise<AgentRunRow[]> {
  const runs: AgentRunRow[] = [];
  let id = run.continuesRunId;

  while (id !== null && runs.length < MAX_CHAIN) {
    const [earlier] = await db.select().from(agentRun).where(eq(agentRun.id, id));

    runs.unshift(...(earlier ? [earlier] : []));
    id = earlier?.continuesRunId ?? null;
  }

  return runs;
}

async function laterRuns(db: PowerLoomDb, run: AgentRunRow): Promise<AgentRunRow[]> {
  const runs: AgentRunRow[] = [];
  let id: number | null = run.id;

  while (id !== null && runs.length < MAX_CHAIN) {
    const [later] = await db.select().from(agentRun).where(eq(agentRun.continuesRunId, id));

    runs.push(...(later ? [later] : []));
    id = later?.id ?? null;
  }

  return runs;
}
