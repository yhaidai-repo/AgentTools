import type { ChatLaunch } from "./ChatLaunch";
import type { ChatRequest } from "./ChatRequest";
import type { Outcome } from "./Outcome";

// One agent app a chat can be continued in (model agnostic, user decision 2026-10-05). A new app or model is a new
// launcher in the registry; the targets (PBI, item, review) don't change.
export interface ChatLauncher {
  id: string;
  label: string; // the button says "Continue with <label>"
  open(request: ChatRequest): Outcome<ChatLaunch>;
}
