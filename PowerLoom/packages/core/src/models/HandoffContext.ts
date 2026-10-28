import type { HandoffView } from "./HandoffView";
import type { PreviousResult } from "./PreviousResult";

// What a task is handed before its run: the hand-offs that created it, the hand-offs into the items it depends on (a
// review's outcome), and its own latest result (null on a first run or Start over).
export interface HandoffContext {
  incoming: HandoffView[];
  dependencies: HandoffView[];
  previous: PreviousResult | null;
}
