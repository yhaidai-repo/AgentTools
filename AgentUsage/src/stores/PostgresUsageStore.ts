import type { Pool } from "pg";
import type { RunOutcome } from "../models/RunOutcome";
import type { StoredTraceEvent } from "../models/StoredTraceEvent";
import type { UsageLabels } from "../models/UsageLabels";
import type { UsageQuery } from "../models/UsageQuery";
import type { UsageRecord } from "../models/UsageRecord";
import type { UsageStore } from "../models/UsageStore";
import type { UsageTotals } from "../models/UsageTotals";
import { SCHEMA_SQL } from "./postgresSchema";
import { NOT_FAILED_OUTCOMES } from "../outcome";
import { IncompleteAccountingError } from "../IncompleteAccountingError";

type Row = Record<string, any>;

export class PostgresUsageStore implements UsageStore {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async saveRecord(record: UsageRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_usage.usage_record (run_id, labels, started_at, ended_at, duration_ms, turns, outcome, error,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, provider_cost_usd, models, subscription, accounting_complete)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (run_id) DO NOTHING`,
      [record.runId, JSON.stringify(record.labels), record.startedAt, record.endedAt, record.durationMs, record.turns,
        record.outcome, record.error, record.inputTokens, record.outputTokens, record.cacheReadTokens,
        record.cacheWriteTokens, record.costUsd, record.providerCostUsd, JSON.stringify(record.models), JSON.stringify(record.subscription ?? []), record.accountingComplete !== false],
    );
  }

  async appendTrace(events: StoredTraceEvent[]): Promise<void> {
    const rows = events.map((event) => [event.runId, event.seq, event.at, event.type, JSON.stringify(event.payload)]);

    await this.pool.query(
      `INSERT INTO agent_usage.run_event (run_id, seq, at, type, payload)
       SELECT * FROM unnest($1::text[], $2::int[], $3::timestamptz[], $4::text[], $5::jsonb[])
       ON CONFLICT DO NOTHING`,
      [0, 1, 2, 3, 4].map((column) => rows.map((row) => row[column])),
    );
  }

  async costSince(from: Date, match: UsageLabels): Promise<number> {
    const result = await this.pool.query(
      "SELECT coalesce(sum(cost_usd), 0) AS cost, bool_and(accounting_complete) AS complete FROM agent_usage.usage_record WHERE started_at >= $1 AND labels @> $2",
      [from, JSON.stringify(match)],
    );

    if (result.rows[0].complete === false) throw new IncompleteAccountingError();
    return Number(result.rows[0].cost);
  }

  async totals(query: UsageQuery, groupBy: string): Promise<UsageTotals[]> {
    const result = await this.pool.query(
      `SELECT labels ->> $4 AS grp, count(*) AS runs, count(*) FILTER (WHERE outcome <> ALL($5::text[])) AS failures,
         sum(input_tokens) AS input, sum(output_tokens) AS output, sum(cache_read_tokens) AS cache_read,
         sum(cache_write_tokens) AS cache_write, sum(cost_usd) AS cost, sum(duration_ms) AS duration, bool_and(accounting_complete) AS complete,
         max(ended_at) AS last_at, (array_agg(outcome ORDER BY started_at DESC))[1] AS last_outcome
       FROM agent_usage.usage_record
       WHERE started_at >= $1 AND started_at < $2 AND labels @> $3 AND ($6::text[] IS NULL OR run_id = ANY($6::text[]))
       GROUP BY 1 ORDER BY 1`,
      [query.from, query.to ?? new Date(), JSON.stringify(query.match ?? {}), groupBy, NOT_FAILED_OUTCOMES, query.runIds ?? null],
    );

    return result.rows.map(toTotals);
  }

  async records(query: UsageQuery, limit?: number): Promise<UsageRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM agent_usage.usage_record
       WHERE started_at >= $1 AND started_at < $2 AND labels @> $3 AND ($4::text[] IS NULL OR run_id = ANY($4::text[]))
       ORDER BY started_at DESC, run_id DESC LIMIT $5`,
      [query.from, query.to ?? new Date(), JSON.stringify(query.match ?? {}), query.runIds ?? null, limit ?? null],
    );

    return result.rows.map(toRecord);
  }

  async trace(runId: string, sessionId?: string): Promise<StoredTraceEvent[]> {
    const result = await this.pool.query(
      "SELECT * FROM agent_usage.run_event WHERE run_id = $1 AND ($2::text IS NULL OR payload->>'sessionId' = $2) ORDER BY seq",
      [runId, sessionId ?? null],
    );

    return result.rows.map((row: Row) => ({ runId: row.run_id, seq: row.seq, at: row.at, type: row.type, payload: row.payload }));
  }

  async purgeTraceBefore(date: Date): Promise<number> {
    const result = await this.pool.query("DELETE FROM agent_usage.run_event WHERE at < $1", [date]);

    return result.rowCount ?? 0;
  }

}

function toTotals(row: Row): UsageTotals {
  return {
    group: row.grp ?? "",
    runs: Number(row.runs),
    failures: Number(row.failures),
    inputTokens: Number(row.input),
    outputTokens: Number(row.output),
    cacheReadTokens: Number(row.cache_read),
    cacheWriteTokens: Number(row.cache_write),
    costUsd: Number(row.cost),
    accountingComplete: row.complete !== false,
    durationMs: Number(row.duration),
    lastRunAt: row.last_at,
    lastOutcome: row.last_outcome as RunOutcome | null,
  };
}

function toRecord(row: Row): UsageRecord {
  return {
    runId: row.run_id,
    labels: row.labels,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    turns: row.turns,
    outcome: row.outcome,
    error: row.error,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    cacheReadTokens: Number(row.cache_read_tokens),
    cacheWriteTokens: Number(row.cache_write_tokens),
    costUsd: Number(row.cost_usd),
    accountingComplete: row.accounting_complete !== false,
    providerCostUsd: row.provider_cost_usd === null ? null : Number(row.provider_cost_usd),
    models: row.models,
    subscription: row.subscription ?? [],
  };
}
