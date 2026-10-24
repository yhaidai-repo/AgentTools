import { dataAccess, type PowerLoomDb } from "@powerloom/db";
import type { DataAccessRow } from "./models/DataAccessRow";

// A reason is a short line in the log, not a report.
const MAX_REASON_CHARS = 300;

// Writes the data access log (user decision 2026-10-13: every outside read traceable). A failed write is logged and
// never fails the read: the work goes on, the gap shows in the process's log.
export async function recordDataAccess(db: PowerLoomDb, row: DataAccessRow): Promise<void> {
  try {
    await db.insert(dataAccess).values({ ...row, reason: row.reason?.slice(0, MAX_REASON_CHARS) ?? null });
  } catch (error) {
    console.error(`data access log: ${row.tool} on ${row.resource} (run ${row.runId ?? "none"}) not recorded:`, error);
  }
}
