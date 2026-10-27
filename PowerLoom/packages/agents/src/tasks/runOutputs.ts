import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";

// Every writer appends atomically. Repeated IDs keep their first position, including the toolset's final aggregation.
export async function addRunOutputs(db: PowerLoomDb, runId: number, outputs: string[]): Promise<void> {
  if (outputs.length === 0) {
    return;
  }

  await db.update(agentRun).set({ outputs: sql`(select coalesce(jsonb_agg(value order by first_seen), '[]'::jsonb) from
    (select value, min(ordinality) as first_seen from jsonb_array_elements_text(coalesce(${agentRun.outputs}, '[]'::jsonb) || ${JSON.stringify(outputs)}::jsonb)
      with ordinality as entries(value, ordinality) group by value) as merged)` }).where(eq(agentRun.id, runId));
}
