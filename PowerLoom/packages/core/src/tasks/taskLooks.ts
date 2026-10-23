import type { TaskBucket } from "../models/TaskBucket";
import type { TaskLike } from "../models/TaskLike";
import { isOpen } from "./items";

// The status pills of the Tasks page, as task.list filters by them ("all" stands for every one).
export const TASK_BUCKETS = ["you", "held", "open", "done", "cancelled"] as const satisfies readonly TaskBucket[];

const CANCELLED_STATUSES = ["cancelled", "dismissed", "superseded", "deleted"];

export function isHumanWork(task: TaskLike): boolean {
  return task.assignee === "human";
}

// What a task waits for: you (an open human item), the dispatcher (held), an agent (open), or nothing any more.
export function taskBucket(task: TaskLike): TaskBucket {
  if (!isOpen(task)) {
    return CANCELLED_STATUSES.includes(task.status) ? "cancelled" : "done";
  }

  if (isHumanWork(task)) {
    return "you";
  }

  return task.status === "open" && task.heldBy.length > 0 ? "held" : "open";
}
