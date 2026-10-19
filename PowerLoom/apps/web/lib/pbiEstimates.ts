import { sql } from "drizzle-orm";
import type { PbiEstimate } from "@/models/PbiEstimate";
import { getDb } from "./db";

// The vault's finished PBIs, newest finish first, with the Original Estimate and the latest agent estimate (user request
// 2026-10-16: original estimate against the effort given at finish; user decision 2026-10-18: the latest estimate from
// any agent). A PBI finished twice counts its latest finish.
export async function loadPbiEstimates(limit: number, vault: string): Promise<PbiEstimate[]> {
  const result = await getDb().execute<Omit<PbiEstimate, "finishedAt"> & { finishedAt: string }>(sql`
    with finish as (
      select distinct on (pbi_id) pbi_id, effort_hours, created_at from pbi_feedback order by pbi_id, created_at desc, id desc
    ), original as (
      select distinct on (ado_id) ado_id, effort from sprint_snapshot where effort is not null order by ado_id, taken_on desc
    ), estimated as (
      select distinct on (pbi_id) pbi_id, human_hours, agent_hours, agent from pbi_estimate order by pbi_id, created_at desc, id desc
    )
    select f.pbi_id as "pbiId", w.title, o.effort::float as "originalHours", e.human_hours::float as "humanHours",
      e.agent_hours::float as "agentHours", e.agent as "estimatedBy", f.effort_hours::float as "actualHours", f.created_at as "finishedAt"
    from finish f
    join work_item w on w.ado_id = f.pbi_id
    left join original o on o.ado_id = f.pbi_id
    left join estimated e on e.pbi_id = f.pbi_id
    where w.vault = ${vault}
    order by f.created_at desc
    limit ${limit}`);

  // Raw SQL hands timestamps over as text.
  return result.rows.map((row) => ({ ...row, finishedAt: new Date(row.finishedAt) }));
}
