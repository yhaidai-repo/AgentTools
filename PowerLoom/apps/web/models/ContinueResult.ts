import type { ActionResult } from "./ActionResult";

// The link the browser opens to start the agent chat; null when the chat can't open.
export interface ContinueResult extends ActionResult {
  link: string | null;
}
