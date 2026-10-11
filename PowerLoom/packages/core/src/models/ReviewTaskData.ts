// A code-review task's subject (local_item.data): the pull request, and its commit when the task was queued.
export interface ReviewTaskData {
  prId: number;
  commit: string;
}
