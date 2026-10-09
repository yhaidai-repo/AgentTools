// A bug work item the dispatcher prepares for refinement, with its vault (prepare works one vault at a time).
export interface BugToPrepare {
  adoId: number;
  vault: string;
}
