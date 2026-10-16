import type { AgentDefinition } from "@agenttools/config";
import { HorizontalBars } from "@/components/charts/HorizontalBars";
import { agentColor } from "@/lib/agentColors";
import { formatUsd } from "@/lib/format";
import type { AgentActivity } from "@/models/AgentActivity";
import type { ChartBar } from "@/models/ChartBar";

const MINUTE_MS = 60_000;

// What a minute of each agent's run time costs over the period (user request 2026-10-16): an agent's price per unit of
// work, however many runs it had.
export function CostPerMinute({ agents, byAgent }: { agents: AgentDefinition[]; byAgent: Map<string, AgentActivity> }) {
  const bars = agents.flatMap((agent, slot) => barOf(agent, slot, byAgent.get(agent.id)));

  return <HorizontalBars title="Cost per minute of run time" bars={bars} format={formatUsd} empty="No finished runs in this period." />;
}

// An agent without a finished run has no run time, so no bar.
function barOf(agent: AgentDefinition, slot: number, activity: AgentActivity | undefined): ChartBar[] {
  if (!activity || activity.durationMs === 0) {
    return [];
  }

  return [{ key: agent.id, label: agent.label, color: agentColor(slot), value: activity.costUsd / (activity.durationMs / MINUTE_MS) }];
}
