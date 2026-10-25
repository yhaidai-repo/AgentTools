import { isCancellableFromTaskList, isRerunnableTask } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { TaskListAction } from "@/models/TaskListAction";

type ItemRow = typeof localItem.$inferSelect;

const ACTIONS: TaskListAction[] = ["cancel", "rerun", "start-over"];

// What each action did, and the word for a task it left alone.
export const ACTION_WORDS: Record<TaskListAction, { done: string; notDone: string }> = {
  cancel: { done: "cancelled", notDone: "Not cancelled" },
  rerun: { done: "reopened; each runs on its agent's next dispatch or Run now", notDone: "Not reopened" },
  "start-over": { done: "reopened to start over; each runs on its agent's next dispatch or Run now", notDone: "Not reopened" },
};

export function taskListActionOf(value: FormDataEntryValue | null): TaskListAction | null {
  return ACTIONS.find((action) => action === value) ?? null;
}

/** A row gets a checkbox when some action of the bar applies to it. */
export function isSelectableTask(task: ItemRow): boolean {
  return isCancellableFromTaskList(task) || isRerunnableTask(task);
}

/** Why the action leaves this task alone (it started, ended or changed meanwhile), or null when it applies. */
export function taskListRefusal(task: ItemRow, action: TaskListAction): string | null {
  if (action === "cancel") {
    return isCancellableFromTaskList(task) ? null : `${task.id} no longer waits (${task.status}).`;
  }

  return isRerunnableTask(task) ? null : `${task.id} can't be re-run (${task.status}).`;
}
