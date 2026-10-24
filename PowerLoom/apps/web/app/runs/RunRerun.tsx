import { isRerunnableTask } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import { RerunTaskButton } from "@/app/items/RerunTaskButton";
import { taskRunState } from "@/lib/taskRunState";

type TaskRow = typeof localItem.$inferSelect;

// Re-run for a run's task: offered when the task is finished or blocked; a task that already runs again says so.
export function RunRerun({ task }: { task: TaskRow | null }) {
  if (!task) {
    return null;
  }

  if (isRerunnableTask(task)) {
    return <RerunTaskButton adoId={task.pbiId} itemId={task.id} />;
  }

  const state = taskRunState(task);

  return state ? <span className="muted">{task.id} {state}</span> : null;
}
