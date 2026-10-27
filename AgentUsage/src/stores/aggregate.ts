import type { UsageLabels } from "../models/UsageLabels";
import type { UsageQuery } from "../models/UsageQuery";
import type { UsageRecord } from "../models/UsageRecord";
import type { UsageTotals } from "../models/UsageTotals";
import { isFailedOutcome } from "../outcome";

// In-memory equivalents of the Postgres queries, for stores without a database.
export function inQuery(record: UsageRecord, query: UsageQuery): boolean {
  const to = query.to ?? new Date();

  return record.startedAt >= query.from && record.startedAt < to && labelsMatch(record.labels, query.match ?? {}) && (query.runIds === undefined || query.runIds.includes(record.runId));
}

export function labelsMatch(labels: UsageLabels, match: UsageLabels): boolean {
  return Object.entries(match).every(([key, value]) => labels[key] === value);
}

export function totalsOf(records: UsageRecord[], groupBy: string): UsageTotals[] {
  const groups = new Map<string, UsageRecord[]>();

  records.forEach((record) => {
    const group = record.labels[groupBy] ?? "";

    groups.set(group, [...(groups.get(group) ?? []), record]);
  });

  return [...groups].map(([group, items]) => totalsOfGroup(group, items)).sort((a, b) => a.group.localeCompare(b.group));
}

function totalsOfGroup(group: string, records: UsageRecord[]): UsageTotals {
  const latest = [...records].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const sum = (pick: (record: UsageRecord) => number) => records.reduce((total, record) => total + pick(record), 0);

  return {
    group,
    runs: records.length,
    failures: records.filter((record) => isFailedOutcome(record.outcome)).length,
    inputTokens: sum((record) => record.inputTokens),
    outputTokens: sum((record) => record.outputTokens),
    cacheReadTokens: sum((record) => record.cacheReadTokens),
    cacheWriteTokens: sum((record) => record.cacheWriteTokens),
    costUsd: sum((record) => record.costUsd),
    accountingComplete: records.every((record) => record.accountingComplete !== false),
    durationMs: sum((record) => record.durationMs),
    lastRunAt: latest?.endedAt ?? null,
    lastOutcome: latest?.outcome ?? null,
  };
}
