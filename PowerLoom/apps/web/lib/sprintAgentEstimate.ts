import { sql } from "drizzle-orm";
import type { AgentEstimate } from "@/models/AgentEstimate";
import { getDb } from "./db";

// The agents' estimate of a sprint's work (user requests 2026-10-18), split into human and agent time: for each of the
// vault's PBIs on the sprint's last snapshot day, the latest design's human estimate, else the latest refinement's
// (design is later and finer; assumption, to confirm), and the design's agent estimate. Null when no PBI has one.
export async function loadSprintAgentEstimate(iterationPath: string, lastDay: string, vault: string): Promise<AgentEstimate> {
  const result = await getDb().execute<AgentEstimate & Record<string, unknown>>(sql`
    with refined as (
      select distinct on (pbi_id) pbi_id, est_hours from refinement order by pbi_id, version desc
    ), designed as (
      select distinct on (pbi_id) pbi_id, est_human_h, est_agent_h from design order by pbi_id, version desc
    )
    select sum(coalesce(d.est_human_h, r.est_hours))::float as "humanHours", sum(d.est_agent_h)::float as "agentHours"
    from sprint_snapshot s
    join work_item w on w.ado_id = s.ado_id
    left join refined r on r.pbi_id = s.ado_id
    left join designed d on d.pbi_id = s.ado_id
    where s.iteration_path = ${iterationPath} and s.taken_on = ${lastDay}::date and w.vault = ${vault}`);

  return result.rows[0] ?? { humanHours: null, agentHours: null };
}
