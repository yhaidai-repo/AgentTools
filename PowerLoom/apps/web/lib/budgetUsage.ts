import { budgetDayStart, type UsageLabels } from "@agenttools/usage";
import { spentToday as spentTodayOf, spentTodayByAgent as spentTodayByAgentOf } from "@powerloom/core";
import { getUsageStore } from "./usage";

// What the daily budget check counts (core's spentToday with the web's usage store).
export function spentToday(match: UsageLabels = {}): Promise<number | null> {
  return spentTodayOf(getUsageStore(), match);
}

// Each agent's spend today, the number its page's Today tile shows.
export function spentTodayByAgent(agentIds: string[]): Promise<Map<string, number | null>> {
  return spentTodayByAgentOf(getUsageStore(), agentIds);
}

export async function budgetReservedToday(agent: string): Promise<number> {
  const records = await getUsageStore().records({ from: budgetDayStart(), match: { agent } });
  return records.reduce((sum, r) => sum + (r.accountingComplete === false && r.budgetReservationUsd ? r.budgetReservationUsd : 0), 0);
}
