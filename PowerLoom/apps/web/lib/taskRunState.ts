import type { localItem } from "@powerloom/db";

type TaskRow = typeof localItem.$inferSelect;

// Why a run's task can't be re-run right now, in words: it already runs again (open: queued for its agent's next
// dispatch; in progress: running, or claimed and waiting for the agent-runner). Null for every other state.
export function taskRunState(task: TaskRow): string | null {
  if (task.status === "open") {
    return "queued: runs on the next dispatch";
  }

  return task.status === "in-progress" ? "in progress: running or waiting for the agent-runner" : null;
}
