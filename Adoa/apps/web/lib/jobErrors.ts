import { getPool } from "./db";

export interface JobError {
  queue: string;
  failedAt: Date;
  message: string;
}

// Failed pg-boss jobs (sync, prepare, render, agent batches): errors outside a single run, never hidden.
export async function loadJobErrors(from: Date, limit = 20): Promise<JobError[]> {
  const result = await getPool().query(
    `SELECT name, coalesce(completed_on, created_on) AS failed_at, coalesce(output->>'message', output::text, '') AS message
     FROM pgboss.job WHERE state = 'failed' AND created_on >= $1
     ORDER BY coalesce(completed_on, created_on) DESC LIMIT $2`,
    [from, limit],
  );

  return result.rows.map((row) => ({ queue: row.name, failedAt: row.failed_at, message: row.message }));
}
