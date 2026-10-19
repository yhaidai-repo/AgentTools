import type { Conversation } from "@agenttools/runtime";

// How the agent run starts: the first message (the task's, or the continuation note) and the conversation it writes.
export interface RunOpening {
  firstMessage: string;
  conversation: Conversation | undefined;
}
