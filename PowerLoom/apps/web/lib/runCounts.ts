import { loadRunCounts as loadRunCountsOf, type RunCounts } from "@powerloom/core";
import { getDb } from "./db";

// Per agent, the vault's runs in the period (core's loadRunCounts with the web's database).
export function loadRunCounts(from: Date, vault: string): Promise<Map<string, RunCounts>> {
  return loadRunCountsOf(getDb(), from, vault);
}
