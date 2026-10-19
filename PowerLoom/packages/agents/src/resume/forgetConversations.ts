import { agentRun } from "@powerloom/db";
import type { ConversationStore } from "@agenttools/runtime";
import { and, eq, isNotNull } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";

// After a successful run no later run continues the task's conversations, so their transcripts go. A delete that fails
// only leaves a file for the CLI's own sweep (cleanupPeriodDays).
export async function forgetConversations(deps: AgentDeps, provider: string, taskId: string): Promise<void> {
  const conversations = deps.runtimes.get(provider).conversations;

  if (!conversations) {
    return;
  }

  const runs = await deps.db
    .select({ conversationId: agentRun.conversationId })
    .from(agentRun)
    .where(and(eq(agentRun.itemId, taskId), isNotNull(agentRun.conversationId)));

  for (const run of runs) {
    await removeQuietly(conversations, run.conversationId);
  }
}

async function removeQuietly(conversations: ConversationStore, id: string | null): Promise<void> {
  if (!id) {
    return;
  }

  try {
    await conversations.remove(id);
  } catch (error) {
    console.warn(`conversation ${id} not removed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
