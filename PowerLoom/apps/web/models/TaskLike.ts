// What the task tags and pills read of a local item (a task, question or finding).
export interface TaskLike {
  kind: string;
  status: string;
  assignee: string;
  heldBy: string[];
}
