import type { HandoffIntent } from "@powerloom/db";

// A hand-off a run made, as settling its task needs it: what it asked of which item.
export interface RunHandoff {
  intent: HandoffIntent;
  toItemId: string;
}
