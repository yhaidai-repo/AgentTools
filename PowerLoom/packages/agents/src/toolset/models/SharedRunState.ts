import type { RunEstimate } from "../../estimate/RunEstimate";

// What the shared toolset holds during the run and a writer's tools may consult (the estimate recorded so far).
export interface SharedRunState {
  estimate: RunEstimate;
}
