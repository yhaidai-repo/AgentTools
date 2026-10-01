import { isRerunnableTask } from "@adoa/core";
import type { agentRun, localItem } from "@adoa/db";

type RunRow = typeof agentRun.$inferSelect;
type TaskRow = typeof localItem.$inferSelect;

// A run can be selected for "Re-run selected" when its task is finished or blocked; an open task runs again by itself.
export function RunSelect({ run, task }: { run: RunRow; task: TaskRow | null }) {
  if (!task || !isRerunnableTask(task)) {
    return <span title={task?.status === "open" ? "Task open: runs again on schedule" : undefined} />;
  }

  return <input type="checkbox" name="taskId" value={task.id} aria-label={`Select RUN-${run.id}`} />;
}
