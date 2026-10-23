import type { TaskBucket } from "./TaskBucket";

// The Tasks page filters, read from the URL. pbi: "" any, "none" items without a PBI, or a PBI's id. status: what the
// task waits for (a status pill), "all" for every one.
export interface TaskFilter {
  kind: string;
  status: TaskBucket | "all";
  pbi: string;
  /** A period key (by when the item was created), shared with Agents and Runs. */
  range: string;
  /** What waits on you on top (the default), or simply the latest change first (user request 2026-10-18). */
  youFirst: boolean;
  page: number;
  size: number;
}
