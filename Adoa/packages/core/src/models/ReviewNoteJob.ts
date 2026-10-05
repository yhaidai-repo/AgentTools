// "Continue with Claude" on a review page: the worker renders the PR's review note before the chat reads it.
export interface ReviewNoteJob {
  prId: number;
}
