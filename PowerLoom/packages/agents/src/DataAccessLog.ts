import { dataAccess, type PowerLoomDb } from "@powerloom/db";
import type { DataAccessEntry } from "./models/DataAccessEntry";

// A reason is a short line in the log, not a report.
const MAX_REASON_CHARS = 300;

// Writes the data access log (user decision 2026-10-13: every outside read traceable). A failed write is logged and
// never fails the tool: the agent's work goes on, the gap shows in the runner's log.
export class DataAccessLog {
  constructor(private readonly db: PowerLoomDb) {}

  async record(entry: DataAccessEntry): Promise<void> {
    try {
      await this.db.insert(dataAccess).values({ ...entry, reason: entry.reason?.slice(0, MAX_REASON_CHARS) ?? null });
    } catch (error) {
      console.error(`data access log: ${entry.tool} on ${entry.resource} (run ${entry.runId}) not recorded:`, error);
    }
  }
}
