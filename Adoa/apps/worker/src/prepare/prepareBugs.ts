import { bugsToPrepare } from "@adoa/core";
import type { WorkerContext } from "../models/WorkerContext";
import { requireEnv } from "../env";

// Bugs are prepared without the user (user decision 2026-10-09): a new or changed bug gets its note and refinement task
// on the next dispatcher tick, from ADO sync and bug.report alike. PowerLoom prepares them (2026-10-11); this tick only
// finds them until ReportBug moves too. Returns a log line, or null when there was nothing to prepare.
export async function prepareBugs(context: WorkerContext): Promise<string | null> {
  const adoIds = (await bugsToPrepare(context.db)).map((bug) => bug.adoId);

  if (adoIds.length === 0) {
    return null;
  }

  const response = await fetch(`${requireEnv("POWERLOOM_URL").replace(/\/+$/, "")}/api/pbis/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adoIds }),
  });

  if (!response.ok) {
    throw new Error(`PowerLoom didn't take the bugs to prepare: ${response.status}`);
  }

  return `bugs prepared: ${adoIds.join(", ")} (queued in PowerLoom)`;
}
