import { loadTaskList as loadTaskListOf, type TaskFilter } from "@powerloom/core";
import { getDb } from "./db";

// The task list lives in core (shared with task.list); the page keeps its names and the web's database.
export { TASK_KINDS, bucketOf, countBy, matchesTask, sortTasks, type TaskRow } from "@powerloom/core";

export const TASK_PAGE_SIZES = [25, 50, 100];

export function loadTaskList(filter: Pick<TaskFilter, "pbi" | "range">, vault: string) {
  return loadTaskListOf(getDb(), filter, vault);
}
