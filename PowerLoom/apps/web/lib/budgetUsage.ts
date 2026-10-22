import { budgetDayStart, type UsageLabels } from "@agenttools/usage";
import { getUsageStore } from "./usage";

// What the daily budget check counts: finished runs since the budget day started (a running run counts once it ends).
export function spentToday(match: UsageLabels = {}): Promise<number> {
  return getUsageStore().costSince(budgetDayStart(), match);
}

// Each agent's spend today, the number its page's Today tile shows.
export async function spentTodayByAgent(agentIds: string[]): Promise<Map<string, number>> {
  const spent = await Promise.all(agentIds.map((agent) => spentToday({ agent })));

  return new Map(agentIds.map((agent, index) => [agent, spent[index]]));
}
