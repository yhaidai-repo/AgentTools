import type { UsageRecord } from "@agenttools/usage";
import type { localItem } from "@powerloom/db";
import type { AgentRunRow } from "./AgentRunRow";

// One row of the Runs tab: the run, the task it worked on, and its usage record once it ended.
export interface RunListRow {
  run: AgentRunRow;
  task: typeof localItem.$inferSelect | null;
  usage: UsageRecord | null;
}
