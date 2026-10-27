import { isRerunnableTask } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import { RerunTaskButton } from "@/app/items/RerunTaskButton";
import { StopTaskButton } from "@/app/items/StopTaskButton";
import { taskRunState } from "@/lib/taskRunState";

type TaskRow = typeof localItem.$inferSelect;

// Re-run for a run's task: offered when the task is finished or blocked; a task that already runs again says so. A run
// still in progress offers Stop instead.
export function RunRerun({ task, isRunning = false }: { task: TaskRow | null; isRunning?: boolean }) {
  if (!task) {
    return null;
  }

  if (isRunning) {
    return <StopTaskButton adoId={task.pbiId} itemId={task.id} />;
  }

  if (isRerunnableTask(task)) {
    return <RerunTaskButton adoId={task.pbiId} itemId={task.id} />;
  }

  const state = taskRunState(task);

  return state ? <span className="muted">{task.id} {state}</span> : null;
}
