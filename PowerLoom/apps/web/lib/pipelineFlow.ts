import { pipelineStatus } from "@powerloom/db";
import { sql } from "drizzle-orm";
import type { StatusDwell } from "@/models/StatusDwell";
import { getDb } from "./db";

// Time in each pipeline status of the vault's PBIs, from the gaps between a PBI's consecutive transitions; in pipeline
// order.
export async function loadTimeInStatus(vault: string): Promise<StatusDwell[]> {
  const result = await getDb().execute<StatusDwell & Record<string, unknown>>(sql`
    with steps as (
      select h.from_status, extract(epoch from (h.at - lag(h.at) over (partition by h.entity_kind, h.entity_id order by h.at, h.id))) / 3600 as hours
      from status_history h
      join work_item w on w.ado_id::text = h.entity_id
      where h.entity_kind = 'pbi' and w.vault = ${vault}
    )
    select from_status as "status", count(*)::int as "transitions", (percentile_cont(0.5) within group (order by hours))::float as "medianHours", (percentile_cont(0.95) within group (order by hours))::float as "p95Hours"
    from steps
    where from_status is not null and hours is not null
    group by from_status`);
  const order: string[] = pipelineStatus.enumValues;

  return result.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}
