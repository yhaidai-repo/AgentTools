import type { agentRun } from "@powerloom/db";

// The task's last run, when it ended without success and kept its conversation.
export type PreviousRun = typeof agentRun.$inferSelect & { conversationId: string };
