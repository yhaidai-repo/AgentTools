import { sql } from "drizzle-orm";
import type { PbiEstimate } from "@/models/PbiEstimate";
import { getDb } from "./db";

// The finished PBIs, newest finish first, with every estimate PowerLoom knows for them (user request 2026-10-16:
// original estimate against the effort given at finish). A PBI finished twice counts its latest finish.
export async function loadPbiEstimates(limit: number): Promise<PbiEstimate[]> {
  const result = await getDb().execute<Omit<PbiEstimate, "finishedAt"> & { finishedAt: string }>(sql`
    with finish as (
      select distinct on (pbi_id) pbi_id, effort_hours, created_at from pbi_feedback order by pbi_id, created_at desc, id desc
    ), original as (
      select distinct on (ado_id) ado_id, effort from sprint_snapshot where effort is not null order by ado_id, taken_on desc
    ), refined as (
      select distinct on (pbi_id) pbi_id, est_hours from refinement order by pbi_id, version desc
    ), designed as (
      select distinct on (pbi_id) pbi_id, est_human_h from design order by pbi_id, version desc
    )
    select f.pbi_id as "pbiId", w.title, o.effort::float as "originalHours", r.est_hours::float as "refinementHours",
      d.est_human_h::float as "designHours", f.effort_hours::float as "actualHours", f.created_at as "finishedAt"
    from finish f
    join work_item w on w.ado_id = f.pbi_id
    left join original o on o.ado_id = f.pbi_id
    left join refined r on r.pbi_id = f.pbi_id
    left join designed d on d.pbi_id = f.pbi_id
    order by f.created_at desc
    limit ${limit}`);

  // Raw SQL hands timestamps over as text.
  return result.rows.map((row) => ({ ...row, finishedAt: new Date(row.finishedAt) }));
}
