import { budgetDayStart, type UsageLabels, type UsageStore } from "@agenttools/usage";

// What the daily budget check counts: finished runs since the budget day started (a running run counts once it ends).
export function spentToday(usage: UsageStore, match: UsageLabels = {}): Promise<number> {
  return usage.costSince(budgetDayStart(), match);
}

// Each agent's spend today, the number its page's Today tile shows.
export async function spentTodayByAgent(usage: UsageStore, agentIds: string[]): Promise<Map<string, number>> {
  const spent = await Promise.all(agentIds.map((agent) => spentToday(usage, { agent })));

  return new Map(agentIds.map((agent, index) => [agent, spent[index]]));
}
