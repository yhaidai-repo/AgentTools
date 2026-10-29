// What an implementation run handed off: the planning task that takes the review's changes back, and the person's
// hand-over task (review the branch, push, open the pull request) with its id.
export interface ImplementationHandoffs {
  hasPlanning: boolean;
  handOverId: string | null;
}
