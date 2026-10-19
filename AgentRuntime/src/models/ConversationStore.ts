import type { PastToolCall } from "./PastToolCall";

// The conversations a runtime keeps, so a host can continue a run that ended early.
export interface ConversationStore {
  exists(id: string): Promise<boolean>;
  toolCalls(id: string): Promise<PastToolCall[]>;
  remove(id: string): Promise<void>;
}
