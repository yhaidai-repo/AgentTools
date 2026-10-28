import { pbiEstimate, type PowerLoomDb } from "@powerloom/db";
import { desc, eq, inArray } from "drizzle-orm";

type EstimateRow = typeof pbiEstimate.$inferSelect;

const NEWEST_FIRST = [desc(pbiEstimate.createdAt), desc(pbiEstimate.id)];

// A PBI shows its latest estimate, from any agent (user decision 2026-10-18).
export async function latestPbiEstimate(db: PowerLoomDb, adoId: number): Promise<EstimateRow | null> {
  const [row] = await db.select().from(pbiEstimate).where(eq(pbiEstimate.pbiId, adoId)).orderBy(...NEWEST_FIRST).limit(1);

  return row ?? null;
}

// The latest estimate these runs recorded: what one task's runs produced.
export async function latestRunEstimate(db: PowerLoomDb, runIds: number[]): Promise<EstimateRow | null> {
  if (runIds.length === 0) {
    return null;
  }

  const [row] = await db.select().from(pbiEstimate).where(inArray(pbiEstimate.runId, runIds)).orderBy(...NEWEST_FIRST).limit(1);

  return row ?? null;
}

// One line, e.g. "12 h human, 3 h agent (planning, RUN-41)". A refinement estimate from before record_estimate has no agent
// hours.
export function estimateText(row: EstimateRow): string {
  const agentHours = row.agentHours === null ? "agent h not given" : `${Number(row.agentHours)} h agent`;
  const source = row.runId === null ? row.agent : `${row.agent}, RUN-${row.runId}`;

  return `${Number(row.humanHours)} h human, ${agentHours} (${source})`;
}
