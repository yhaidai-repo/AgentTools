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
