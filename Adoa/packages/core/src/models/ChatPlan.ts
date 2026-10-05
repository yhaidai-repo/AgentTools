import type { ChatRequest } from "./ChatRequest";
import type { CommandContext } from "./CommandContext";

// A chat ready to open on a target: its request, and what must happen first (render its note, set a status).
export interface ChatPlan {
  request: ChatRequest;
  // Returns why the chat can't open, or null.
  prepare(context: CommandContext): Promise<string | null>;
}
