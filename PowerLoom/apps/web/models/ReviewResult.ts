// A code-review task's result: the pull request's review summary and the comments the task's runs left.
export interface ReviewResult {
  prId: number;
  summary: string | null;
  comments: number;
  open: number;
}
