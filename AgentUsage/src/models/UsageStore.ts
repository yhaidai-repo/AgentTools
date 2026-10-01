import type { StoredTraceEvent } from "./StoredTraceEvent";
import type { SubscriptionSnapshot } from "./SubscriptionSnapshot";
import type { UsageLabels } from "./UsageLabels";
import type { UsageQuery } from "./UsageQuery";
import type { UsageRecord } from "./UsageRecord";
import type { UsageTotals } from "./UsageTotals";

// Storage for usage records, traces and subscription snapshots; Postgres and JSONL implementations ship with the module.
export interface UsageStore {
  saveRecord(record: UsageRecord): Promise<void>;
  appendTrace(events: StoredTraceEvent[]): Promise<void>;
  costSince(from: Date, match: UsageLabels): Promise<number>;
  totals(query: UsageQuery, groupBy: string): Promise<UsageTotals[]>;
  records(query: UsageQuery, limit: number): Promise<UsageRecord[]>;
  trace(runId: string): Promise<StoredTraceEvent[]>;
  purgeTraceBefore(date: Date): Promise<number>;
  /** Keeps one snapshot per provider: the latest. One without windows keeps the last reading and records why. */
  saveSnapshot(snapshot: SubscriptionSnapshot): Promise<void>;
  latestSnapshots(): Promise<SubscriptionSnapshot[]>;
}
