import { loadAgentTotals as loadAgentTotalsOf, loadRunTotals as loadRunTotalsOf, type AgentTotals } from "@powerloom/core";
import { getDb } from "./db";
import { getUsageStore } from "./usage";

// Per agent, the usage of the vault's runs in the period (core's loadAgentTotals with the web's database and usage store).
export function loadAgentTotals(from: Date, vault: string): Promise<Map<string, AgentTotals>> {
  return loadAgentTotalsOf(getDb(), getUsageStore(), from, vault);
}

// What a PBI's runs spent in all (core's loadRunTotals with the web's usage store).
export function loadRunTotals(runs: { id: number; startedAt: Date }[]): Promise<AgentTotals> {
  return loadRunTotalsOf(getUsageStore(), runs);
}
