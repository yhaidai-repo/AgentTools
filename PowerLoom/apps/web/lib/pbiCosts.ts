import { loadCostliestPbis as loadCostliestPbisOf, type PbiCost } from "@powerloom/core";
import { getDb } from "./db";

// The vault's PBIs the agents spent the most on (core's loadCostliestPbis with the web's database).
export function loadCostliestPbis(from: Date, limit: number, vault: string): Promise<PbiCost[]> {
  return loadCostliestPbisOf(getDb(), from, limit, vault);
}
