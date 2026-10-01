import { runSubscriptionShares, subscriptionStatus, type RunSubscriptionShare, type SubscriptionStatus, type UsageRecord } from "@agenttools/usage";
import { getUsageStore } from "./usage";

// The longest window is a week; one more day covers a run that started before the window did.
const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;
const MAX_RECORDS = 2000;

// Each provider's windows as the latest run reported them, and adoa's share of them (no snapshots: usage is read during
// runs only, user decision 2026-10-02).
export async function loadSubscriptionStatus(): Promise<SubscriptionStatus[]> {
  return subscriptionStatus([], await recentRecords());
}

// Every run's share of the window periods it ran in. Periods span all agents, so all their runs are loaded.
export async function loadRunShares(): Promise<Map<string, RunSubscriptionShare[]>> {
  const shares = runSubscriptionShares(await recentRecords());
  const byRun = new Map<string, RunSubscriptionShare[]>();

  for (const share of shares) {
    byRun.set(share.runId, [...(byRun.get(share.runId) ?? []), share]);
  }

  return byRun;
}

function recentRecords(): Promise<UsageRecord[]> {
  return getUsageStore().records({ from: new Date(Date.now() - LOOKBACK_MS) }, MAX_RECORDS);
}
