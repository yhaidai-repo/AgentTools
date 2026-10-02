import type { SubscriptionSample } from "./models/SubscriptionSample";
import type { SubscriptionStatus } from "./models/SubscriptionStatus";
import type { SubscriptionStatusWindow } from "./models/SubscriptionStatusWindow";
import type { SubscriptionUsage } from "./models/SubscriptionUsage";
import type { UsageRecord } from "./models/UsageRecord";
import { periodKey, subscriptionPeriods } from "./subscriptionPeriods";

type Reading = Omit<SubscriptionStatusWindow, "share">;

// Folds a sample into the run's windows: the first sample sets the start, every later one the end.
export function addSubscriptionSample(windows: Map<string, SubscriptionUsage>, sample: SubscriptionSample): void {
  const key = `${sample.provider}:${sample.window}`;
  const resetsAt = sample.resetsAt?.toISOString() ?? null;
  const seen = windows.get(key);
  const startUtilization = startOf(seen, sample, resetsAt);

  windows.set(key, { provider: sample.provider, window: sample.window, label: sample.label, startUtilization, endUtilization: sample.utilization, resetsAt });
}

// Per provider: the windows as its latest run reported them, and how much the runs used of each current window period
// (see SubscriptionPeriod). `records` (newest first) should cover the longest window, e.g. the last 8 days for a weekly limit.
export function subscriptionStatus(records: UsageRecord[]): SubscriptionStatus[] {
  const providers = new Set(records.flatMap(providersOf));

  return [...providers].map((provider) => providerStatus(provider, records));
}

function providerStatus(provider: string, records: UsageRecord[]): SubscriptionStatus {
  const latestRun = records.find((record) => providersOf(record).includes(provider)) ?? null;
  const readings = runReadings(latestRun, provider);

  return {
    provider,
    asOf: latestRun?.endedAt ?? null,
    windows: readings.map((reading) => ({ ...reading, share: periodChange(records, provider, reading) })),
  };
}

function periodChange(records: UsageRecord[], provider: string, reading: Reading): number {
  const key = periodKey(provider, reading.window, reading.resetsAt);

  return subscriptionPeriods(records).find((period) => periodKey(period.provider, period.window, period.resetsAt) === key)?.change ?? 0;
}

function runReadings(record: UsageRecord | null, provider: string): Reading[] {
  const usages = record?.subscription.filter((usage) => usage.provider === provider) ?? [];

  return usages.map((usage) => ({ window: usage.window, label: usage.label, utilization: usage.endUtilization, resetsAt: usage.resetsAt }));
}

function providersOf(record: UsageRecord): string[] {
  return record.subscription.map((usage) => usage.provider);
}

// A window that reset during the run (its reset time moved on) counts from 0 again.
function startOf(seen: SubscriptionUsage | undefined, sample: SubscriptionSample, resetsAt: string | null): number {
  if (!seen) {
    return sample.utilization;
  }

  return seen.resetsAt === resetsAt ? seen.startUtilization : 0;
}
