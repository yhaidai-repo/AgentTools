import { sql } from "drizzle-orm";
import type { JobState } from "@/models/JobState";
import { getDb } from "./db";

// Waiting and running jobs per queue, from pg-boss's own table (created / retry = waiting, active = running).
export async function loadJobStates(): Promise<Map<string, JobState>> {
  const rows = await getDb().execute<{ name: string; waiting: string; running: string; last_completed: Date | null }>(sql`
    SELECT name,
           count(*) FILTER (WHERE state IN ('created', 'retry'))::text AS waiting,
           count(*) FILTER (WHERE state = 'active')::text AS running,
           max(completed_on) FILTER (WHERE state = 'completed') AS last_completed
    FROM pgboss.job
    GROUP BY name`);

  return new Map(rows.rows.map((row) => [row.name, { waiting: Number(row.waiting), running: Number(row.running), lastCompleted: row.last_completed }]));
}
