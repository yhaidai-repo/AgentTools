import { pipelineStatus } from "@powerloom/db";
import { sql } from "drizzle-orm";
import type { StatusDwell } from "@/models/StatusDwell";
import { getDb } from "./db";

// Time in each pipeline status, from the gaps between a PBI's consecutive transitions; in pipeline order.
export async function loadTimeInStatus(): Promise<StatusDwell[]> {
  const result = await getDb().execute<{ status: string; transitions: number; averageHours: number; p95Hours: number }>(sql`
    with steps as (
      select from_status, extract(epoch from (at - lag(at) over (partition by entity_kind, entity_id order by at, id))) / 3600 as hours
      from status_history
      where entity_kind = 'pbi'
    )
    select from_status as "status", count(*)::int as "transitions", avg(hours)::float as "averageHours", (percentile_cont(0.95) within group (order by hours))::float as "p95Hours"
    from steps
    where from_status is not null and hours is not null
    group by from_status`);
  const order: string[] = pipelineStatus.enumValues;

  return result.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}
