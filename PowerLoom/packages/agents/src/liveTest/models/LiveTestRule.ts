import type { LiveTestEntity } from "./LiveTestEntity";
import type { LiveTestTarget } from "./LiveTestTarget";

/** How the live-test guard treats one write command. */
export interface LiveTestRule {
  command: string;
  /** What the call changes: each must be the run's own. */
  targets(input: any): LiveTestTarget[];
  /** Why the call is refused whatever it targets (it would start real work or write a real vault); null when it may run. */
  refusal?(input: any): string | null;
  /** What a successful call created, from its result. */
  created?(output: any, input: any): LiveTestEntity[];
  /** What a successful call removed. */
  removed?(input: any): LiveTestEntity[];
  /** What the test must do besides, added to the tool's description. */
  note?: string;
}
