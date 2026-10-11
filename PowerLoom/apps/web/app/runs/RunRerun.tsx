import { isRerunnableTask } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import { RerunTaskButton } from "@/app/items/RerunTaskButton";

type TaskRow = typeof localItem.$inferSelect;

// Re-run for a run's task: offered when the task is finished or blocked; an open task runs again by itself.
export function RunRerun({ task }: { task: TaskRow | null }) {
  if (!task) {
    return null;
  }

  if (isRerunnableTask(task)) {
    return <RerunTaskButton adoId={task.pbiId} itemId={task.id} />;
  }

  return task.status === "open" ? <span className="muted">task open: runs again on schedule</span> : null;
}
