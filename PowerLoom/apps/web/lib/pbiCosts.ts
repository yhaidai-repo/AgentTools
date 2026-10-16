import { sql } from "drizzle-orm";
import type { PbiCost } from "@/models/PbiCost";
import { getDb } from "./db";

// The PBIs the agents spent the most on since `from`, all vaults (user request 2026-10-16). Usage records are keyed by
// run; a run belongs to its PBI, or to its task's PBI.
export async function loadCostliestPbis(from: Date, limit: number): Promise<PbiCost[]> {
  const result = await getDb().execute<PbiCost & Record<string, unknown>>(sql`
    select w.ado_id as "pbiId", w.title, count(*)::int as "runs", sum(u.cost_usd)::float as "costUsd", sum(u.duration_ms)::float as "durationMs"
    from agent_usage.usage_record u
    join agent_run r on r.id::text = u.run_id
    left join local_item i on i.id = r.item_id
    join work_item w on w.ado_id = coalesce(r.pbi_id, i.pbi_id)
    where u.started_at >= ${from}
    group by w.ado_id, w.title
    order by "costUsd" desc
    limit ${limit}`);

  return result.rows;
}
