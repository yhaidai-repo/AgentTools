import type { CurrentWindowShare } from "./models/CurrentWindowShare";
import type { RunSubscriptionShare } from "./models/RunSubscriptionShare";
import type { UsageRecord } from "./models/UsageRecord";
import { subscriptionStatus } from "./subscription";
import { periodKey, runSubscriptionShares } from "./subscriptionPeriods";

type CurrentWindow = Omit<CurrentWindowShare, "share">;

// Each label value's (e.g. each agent's) share of every provider window's current period, the one the latest run
// reported: its runs' shares (runSubscriptionShares) added up. A window that resets starts a new period, so the share
// starts again at 0. A value lists every current window (0 for one its runs didn't use); a value with no run in any
// current period is left out.
export function currentWindowShares(records: UsageRecord[], labelKey: string): Map<string, CurrentWindowShare[]> {
  const windows = currentWindows(records);
  const used = usedByValue(records, labelKey, new Set(windows.map(keyOf)));

  return new Map([...used].map(([value, byWindow]) => [value, windows.map((window) => ({ ...window, share: byWindow.get(keyOf(window)) ?? 0 }))]));
}

function currentWindows(records: UsageRecord[]): CurrentWindow[] {
  return subscriptionStatus(records).flatMap((status) => status.windows.map((window) => ({ provider: status.provider, window: window.window, label: window.label, resetsAt: window.resetsAt })));
}

function usedByValue(records: UsageRecord[], labelKey: string, currentKeys: Set<string>): Map<string, Map<string, number>> {
  const valueOf = new Map(records.map((record) => [record.runId, record.labels[labelKey] ?? ""]));
  const used = new Map<string, Map<string, number>>();

  for (const share of runSubscriptionShares(records).filter((share) => currentKeys.has(keyOf(share)))) {
    addShare(used, valueOf.get(share.runId) ?? "", keyOf(share), share.share);
  }

  return used;
}

function addShare(used: Map<string, Map<string, number>>, value: string, key: string, share: number): void {
  const byWindow = used.get(value) ?? new Map<string, number>();

  byWindow.set(key, (byWindow.get(key) ?? 0) + share);
  used.set(value, byWindow);
}

function keyOf(window: CurrentWindow | RunSubscriptionShare): string {
  return periodKey(window.provider, window.window, window.resetsAt);
}
