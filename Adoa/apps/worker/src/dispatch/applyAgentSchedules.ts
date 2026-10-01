import { applyAgentSchedule } from "@adoa/core";
import type { AgentConfigStore } from "@agenttools/config";
import type { PgBoss } from "pg-boss";

// AgentConfig is the source of truth for schedules; the worker re-applies them on every change from any client.
export async function applyAgentSchedules(boss: PgBoss, config: AgentConfigStore): Promise<void> {
  const agents = await config.list();

  for (const agent of agents) {
    await applyAgentSchedule(boss, agent.id, agent.schedule, agent.enabled);
  }

  console.log(`agent schedules applied: ${agents.map((agent) => `${agent.id}=${agent.enabled ? agent.schedule : "off"}`).join(", ")}`);
}
