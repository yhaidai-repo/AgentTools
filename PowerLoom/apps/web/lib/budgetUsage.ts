import type { UsageLabels } from "@agenttools/usage";
import { spentToday as spentTodayOf, spentTodayByAgent as spentTodayByAgentOf } from "@powerloom/core";
import { getUsageStore } from "./usage";

// What the daily budget check counts (core's spentToday with the web's usage store).
export function spentToday(match: UsageLabels = {}): Promise<number> {
  return spentTodayOf(getUsageStore(), match);
}

// Each agent's spend today, the number its page's Today tile shows.
export function spentTodayByAgent(agentIds: string[]): Promise<Map<string, number>> {
  return spentTodayByAgentOf(getUsageStore(), agentIds);
}
