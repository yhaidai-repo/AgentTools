// What only per-PR calls return: how many times it was pushed to (ADO iterations) and the work items it links.
export interface AdoPullRequestDetails {
  iteration: number;
  workItemIds: number[];
}
