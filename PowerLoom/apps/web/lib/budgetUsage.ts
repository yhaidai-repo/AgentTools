import { budgetDayStart, type UsageLabels } from "@agenttools/usage";
import { getUsageStore } from "./usage";

// What the daily budget check counts: finished runs since the budget day started (a running run counts once it ends).
export function spentToday(match: UsageLabels = {}): Promise<number> {
  return getUsageStore().costSince(budgetDayStart(), match);
}
