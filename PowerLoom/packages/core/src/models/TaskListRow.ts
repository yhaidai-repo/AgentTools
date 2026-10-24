import type { TaskBucket } from "./TaskBucket";
import type { TaskRow } from "./TaskRow";

// One task as task.list answers it: the Tasks page row without its body (task.get gives that), with what it waits for.
export interface TaskListRow {
  id: string;
  kind: TaskRow["kind"];
  title: string;
  status: TaskRow["status"];
  bucket: TaskBucket;
  assignee: string;
  pbiId: number | null;
  vault: string;
  heldBy: string[];
  updatedAt: Date;
  createdAt: Date;
  runs: TaskRow["runs"];
}
