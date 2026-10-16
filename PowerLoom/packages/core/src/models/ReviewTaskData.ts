// A code-review task's subject (local_item.data): the pull request, and its commit when the task was queued. The PR
// sync's follow-ups for other reviewers' new comments name the trigger and those threads (Better Review weighs them first).
export interface ReviewTaskData {
  prId: number;
  commit: string;
  trigger?: "reviewer-comments";
  threads?: number[];
}
