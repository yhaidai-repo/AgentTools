import type { TaskBucket } from "@/lib/taskLooks";

// The Tasks page filters, read from the URL. pbi: "" any, "none" items without a PBI, or a PBI's id. status: what the
// task waits for (a status pill), "all" for every one.
export interface TaskFilter {
  kind: string;
  status: TaskBucket | "all";
  pbi: string;
  /** A period key of lib/ranges (by when the item was created), shared with Agents and Runs. */
  range: string;
  page: number;
  size: number;
}
