import { bugsToPrepare, type BugToPrepare } from "@adoa/core";
import type { WorkerContext } from "../models/WorkerContext";
import { preparePbis } from "./preparePbis";

const ACTOR = "dispatch";

// Bugs are prepared without the user (user decision 2026-10-09): a new or changed bug gets its note and refinement task
// on the next dispatcher tick, from ADO sync and bug.report alike. Prepare works one vault at a time. Returns a log line,
// or null when there was nothing to prepare.
export async function prepareBugs(context: WorkerContext): Promise<string | null> {
  const byVault = groupByVault(await bugsToPrepare(context.db));
  let queued = 0;

  for (const adoIds of byVault.values()) {
    queued += await preparePbis(context, adoIds, ACTOR);
  }

  return byVault.size === 0 ? null : `bugs prepared: ${[...byVault.values()].flat().join(", ")} (${queued} refinement task(s) queued)`;
}

function groupByVault(bugs: BugToPrepare[]): Map<string, number[]> {
  const byVault = new Map<string, number[]>();

  for (const entry of bugs) {
    byVault.set(entry.vault, [...(byVault.get(entry.vault) ?? []), entry.adoId]);
  }

  return byVault;
}
