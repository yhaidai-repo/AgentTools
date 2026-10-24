import type { DataAccessOutcome } from "@powerloom/db";
import type { OutsideAccessContext } from "./OutsideAccessContext";
import type { OutsideResource } from "./OutsideResource";

// One row of the data access log, as the wrapper builds it.
export interface DataAccessEntry extends OutsideAccessContext, OutsideResource {
  tool: string;
  request: string;
  outcome: DataAccessOutcome;
  reason: string | null;
  rows: number | null;
  bytes: number | null;
  truncated: boolean;
  startedAt: Date;
  durationMs: number;
}
