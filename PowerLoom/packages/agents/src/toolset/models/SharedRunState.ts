import type { RunEstimate } from "../../estimate/RunEstimate";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";

// What the shared toolset holds during the run and a writer's tools may consult: the estimate recorded so far, and the
// tasks create_task and hand_off noted (a `new:<n>` is the n-th of them).
export interface SharedRunState {
  estimate: RunEstimate;
  tasks: readonly CreatedTask[];
}
