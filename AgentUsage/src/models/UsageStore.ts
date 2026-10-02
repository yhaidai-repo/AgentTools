import type { StoredTraceEvent } from "./StoredTraceEvent";
import type { UsageLabels } from "./UsageLabels";
import type { UsageQuery } from "./UsageQuery";
import type { UsageRecord } from "./UsageRecord";
import type { UsageTotals } from "./UsageTotals";

// Storage for usage records and traces; Postgres and JSONL implementations ship with the module.
export interface UsageStore {
  saveRecord(record: UsageRecord): Promise<void>;
  appendTrace(events: StoredTraceEvent[]): Promise<void>;
  costSince(from: Date, match: UsageLabels): Promise<number>;
  totals(query: UsageQuery, groupBy: string): Promise<UsageTotals[]>;
  records(query: UsageQuery, limit: number): Promise<UsageRecord[]>;
  trace(runId: string): Promise<StoredTraceEvent[]>;
  purgeTraceBefore(date: Date): Promise<number>;
}
