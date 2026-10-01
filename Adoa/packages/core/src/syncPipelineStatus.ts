import { localItem, workItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import { AGENT_STAGES, agentIdOf } from "./agentStages";
import type { PipelineStatus } from "./models/PipelineStatus";
import { setPbiStatus } from "./pbiStatus";

type ItemRow = typeof localItem.$inferSelect;

// Set by sync (new, stale, closed) or by the user (prepare), never derived.
const FIXED: PipelineStatus[] = ["new", "stale", "closed"];

// The PBI's pipeline status follows its tasks (user decision 2026-10-01). Called after every change by the worker and
// the agent-runner; returns the new status, or null when it stayed.
export async function syncPipelineStatus(db: AdoaDb, adoId: number, actor: string): Promise<PipelineStatus | null> {
  const [pbi] = await db.select({ status: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi || FIXED.includes(pbi.status)) {
    return null;
  }

  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId));
  const next = deriveStatus(items);

  if (!next || next === pbi.status) {
    return null;
  }

  await setPbiStatus(db, adoId, pbi.status, next, actor);

  return next;
}

// A running agent wins, then the user's open items, then the earliest stage with a waiting task; design done → ready for dev.
function deriveStatus(items: ItemRow[]): PipelineStatus | null {
  const agentTasks = items.filter((item) => agentIdOf(item.assignee) !== null);
  const running = agentTasks.find((task) => task.status === "in-progress");

  if (running) {
    return AGENT_STAGES[agentIdOf(running.assignee)!]?.running ?? null;
  }

  if (items.some((item) => item.assignee === "human" && isOpen(item))) {
    return "waiting-human";
  }

  const waiting = Object.entries(AGENT_STAGES).find(([agentId]) => agentTasks.some((task) => task.assignee === `agent:${agentId}` && task.status === "open"));

  if (waiting) {
    return waiting[1].waiting;
  }

  return agentTasks.some((task) => task.kind === "design" && task.status === "done") ? "ready-for-dev" : null;
}

function isOpen(item: ItemRow): boolean {
  return item.status === "open" || item.status === "in-progress";
}
