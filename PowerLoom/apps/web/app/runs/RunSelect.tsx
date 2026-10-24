import { isRerunnableTask } from "@powerloom/core";
import { taskRunState } from "@/lib/taskRunState";
import type { agentRun, localItem } from "@powerloom/db";

type RunRow = typeof agentRun.$inferSelect;
type TaskRow = typeof localItem.$inferSelect;

// A run can be selected for "Re-run selected" when its task is finished or blocked; a task that already runs again
// (queued or in progress) says so in a dash's tooltip, since the checkbox column has no room for words.
export function RunSelect({ run, task }: { run: RunRow; task: TaskRow | null }) {
  if (!task) {
    return null;
  }

  if (!isRerunnableTask(task)) {
    const state = taskRunState(task);

    return state ? <span className="muted" title={`Can't re-run: ${state}`}>–</span> : null;
  }

  return <input type="checkbox" name="taskId" value={task.id} aria-label={`Select RUN-${run.id}`} />;
}
