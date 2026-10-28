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
  /** Omit limit for complete target-scoped enumeration; explicit limits are for presentation lists. */
  records(query: UsageQuery, limit?: number): Promise<UsageRecord[]>;
  /** With a sessionId, only the events of that sub-session (the run page loads a large trace session by session). */
  trace(runId: string, sessionId?: string): Promise<StoredTraceEvent[]>;
  purgeTraceBefore(date: Date): Promise<number>;
}
