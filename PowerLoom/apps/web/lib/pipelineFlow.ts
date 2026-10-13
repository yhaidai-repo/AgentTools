import { pipelineStatus, statusHistory } from "@powerloom/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { StatusDwell } from "@/models/StatusDwell";
import type { WeekThroughput } from "@/models/WeekThroughput";
import { getDb } from "./db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface WeekCount {
  week: string;
  status: string;
  count: number;
}

// PBIs that reached each of `statuses` per week over the last `weeks` weeks (Monday start, UTC), every week present.
export async function loadWeeklyThroughput(statuses: string[], weeks: number, now: Date): Promise<WeekThroughput[]> {
  const from = new Date(mondayOf(now) - (weeks - 1) * WEEK_MS);
  const byWeek = new Map(weekKeys(from, weeks).map((week) => [week, { week, byStatus: {} } as WeekThroughput]));

  for (const row of await weekCounts(statuses, from)) {
    const week = byWeek.get(row.week);

    if (week) {
      week.byStatus[row.status] = row.count;
    }
  }

  return [...byWeek.values()];
}

// Time in each pipeline status, from the gaps between a PBI's consecutive transitions, with the PBIs in it now; in
// pipeline order. Finished stays only: a PBI still in a status shows in the "now" columns.
export async function loadTimeInStatus(): Promise<StatusDwell[]> {
  const left = await finishedStays();
  const current = await currentStays();
  const statuses = new Set([...left.keys(), ...current.keys()]);
  const order: string[] = pipelineStatus.enumValues;

  return [...statuses]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((status) => ({ status, ...(left.get(status) ?? NO_STAYS), ...(current.get(status) ?? NOBODY_NOW) }));
}

type FinishedStays = Pick<StatusDwell, "transitions" | "averageHours" | "p95Hours">;
type CurrentStays = Pick<StatusDwell, "inStatusNow" | "longestWaitHours">;

const NO_STAYS: FinishedStays = { transitions: 0, averageHours: 0, p95Hours: 0 };
const NOBODY_NOW: CurrentStays = { inStatusNow: 0, longestWaitHours: null };

async function finishedStays(): Promise<Map<string, FinishedStays>> {
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

  return new Map(result.rows.map(({ status, ...stays }) => [status, stays]));
}

// Each PBI's wait counts from its last move into its current status.
async function currentStays(): Promise<Map<string, CurrentStays>> {
  const result = await getDb().execute<{ status: string; inStatusNow: number; longestWaitHours: number | null }>(sql`
    select w.pipeline_status::text as "status", count(*)::int as "inStatusNow",
      max(extract(epoch from (now() - entered.at)) / 3600)::float as "longestWaitHours"
    from work_item w
    left join lateral (
      select max(h.at) as at from status_history h
      where h.entity_kind = 'pbi' and h.entity_id = w.ado_id::text and h.to_status = w.pipeline_status::text
    ) entered on true
    group by w.pipeline_status`);

  return new Map(result.rows.map(({ status, ...now }) => [status, now]));
}

function weekCounts(statuses: string[], from: Date): Promise<WeekCount[]> {
  const week = sql<string>`to_char(date_trunc('week', ${statusHistory.at} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;

  return getDb()
    .select({ week, status: statusHistory.toStatus, count: sql<number>`count(distinct ${statusHistory.entityId})::int` })
    .from(statusHistory)
    .where(and(eq(statusHistory.entityKind, "pbi"), inArray(statusHistory.toStatus, statuses), gte(statusHistory.at, from)))
    .groupBy(week, statusHistory.toStatus);
}

function weekKeys(from: Date, weeks: number): string[] {
  return Array.from({ length: weeks }, (_, index) => new Date(from.getTime() + index * WEEK_MS).toISOString().slice(0, 10));
}

// The Monday 00:00 UTC of the date's week, as Postgres' date_trunc('week') counts it.
function mondayOf(date: Date): number {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const weekday = (date.getUTCDay() + 6) % 7;

  return day - weekday * (WEEK_MS / 7);
}
