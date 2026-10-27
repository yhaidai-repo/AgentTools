import { budgetDayStart, IncompleteAccountingError, type UsageLabels, type UsageStore } from "@agenttools/usage";

// What the daily budget check counts: finished runs since the budget day started (a running run counts once it ends).
export async function spentToday(usage: UsageStore, match: UsageLabels = {}): Promise<number | null> {
  try { return await usage.costSince(budgetDayStart(), match); }
  catch (error) {
    if (error instanceof IncompleteAccountingError) return null;
    throw error;
  }
}

// Each agent's spend today, the number its page's Today tile shows.
export async function spentTodayByAgent(usage: UsageStore, agentIds: string[]): Promise<Map<string, number | null>> {
  const spent = await Promise.all(agentIds.map((agent) => spentToday(usage, { agent })));

  return new Map(agentIds.map((agent, index) => [agent, spent[index]]));
}
