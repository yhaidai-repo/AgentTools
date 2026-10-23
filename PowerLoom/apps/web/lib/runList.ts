import { loadRunList as loadRunListOf, type RunListFilter, type RunListRow } from "@powerloom/core";
import { getDb } from "./db";
import { getUsageStore } from "./usage";

export type { RunListRow };

// The Runs tab's rows (core's loadRunList with the web's database and usage store).
export function loadRunList(filter: RunListFilter, from: Date, vault: string): Promise<RunListRow[]> {
  return loadRunListOf(getDb(), getUsageStore(), filter, from, vault);
}
