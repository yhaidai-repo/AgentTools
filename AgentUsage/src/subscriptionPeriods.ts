import type { RunSubscriptionShare } from "./models/RunSubscriptionShare";
import type { SubscriptionPeriod } from "./models/SubscriptionPeriod";
import type { SubscriptionUsage } from "./models/SubscriptionUsage";
import type { UsageRecord } from "./models/UsageRecord";

// A run's window entry, with the run it belongs to (records hold several windows each).
interface RunWindow {
  record: UsageRecord;
  usage: SubscriptionUsage;
}

// The window periods the records ran in. Runs that saw the same reset time ran in the same period.
export function subscriptionPeriods(records: UsageRecord[]): SubscriptionPeriod[] {
  const byPeriod = new Map<string, RunWindow[]>();

  for (const entry of runWindows(records)) {
    const key = periodKey(entry.usage.provider, entry.usage.window, entry.usage.resetsAt);

    byPeriod.set(key, [...(byPeriod.get(key) ?? []), entry]);
  }

  return [...byPeriod.values()].map(toPeriod);
}

// Each run's share of each period it ran in: the period's change × the run's part of the period's cost. The shares of a
// period add up to its change, and no run with a cost gets 0 unless the whole period's change rounds to 0.
export function runSubscriptionShares(records: UsageRecord[]): RunSubscriptionShare[] {
  const periods = new Map(subscriptionPeriods(records).map((period) => [periodKey(period.provider, period.window, period.resetsAt), period]));

  return runWindows(records).map(({ record, usage }) => {
    const period = periods.get(periodKey(usage.provider, usage.window, usage.resetsAt))!;

    return { runId: record.runId, provider: usage.provider, window: usage.window, label: usage.label, resetsAt: usage.resetsAt, share: costShare(period, record) };
  });
}

export function periodKey(provider: string, window: string, resetsAt: string | null): string {
  return `${provider}|${window}|${resetsAt ?? ""}`;
}

function toPeriod(entries: RunWindow[]): SubscriptionPeriod {
  const byStart = [...entries].sort((a, b) => a.record.startedAt.getTime() - b.record.startedAt.getTime());
  const byEnd = [...entries].sort((a, b) => b.record.endedAt.getTime() - a.record.endedAt.getTime());
  const { provider, window, label, resetsAt } = byEnd[0].usage;

  return {
    provider,
    window,
    label,
    resetsAt,
    change: Math.max(0, byEnd[0].usage.endUtilization - byStart[0].usage.startUtilization),
    costUsd: entries.reduce((total, entry) => total + entry.record.costUsd, 0),
    runIds: entries.map((entry) => entry.record.runId),
  };
}

// A period without cost (e.g. only failed runs before the first turn) is split evenly.
function costShare(period: SubscriptionPeriod, record: UsageRecord): number {
  if (period.costUsd <= 0) {
    return period.change / period.runIds.length;
  }

  return period.change * (record.costUsd / period.costUsd);
}

function runWindows(records: UsageRecord[]): RunWindow[] {
  return records.flatMap((record) => record.subscription.map((usage) => ({ record, usage })));
}
