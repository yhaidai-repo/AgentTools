import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { CHAT_AGENT_ID } from "./models/ChatPrincipal";

type ChatOutcome = "success" | "aborted" | "failed";

// One MCP session as one run of the `chat` agent (decision MCPQ-002, 2026-10-23): the Runs page, the Tools tab and the
// data access log show a chat's calls like an agent's. No task, no PBI, no usage: the chat's tokens are the chat's.
export class ChatRun {
  private constructor(
    private readonly db: PowerLoomDb,
    readonly id: number,
  ) {}

  static async begin(db: PowerLoomDb, session: { vault: string; client: string }): Promise<ChatRun> {
    const [row] = await db
      .insert(agentRun)
      .values({ stage: CHAT_AGENT_ID, pbiId: null, itemId: null, model: session.client, input: JSON.stringify(session) })
      .returning({ id: agentRun.id });

    return new ChatRun(db, row.id);
  }

  async end(outcome: ChatOutcome, error: string | null = null): Promise<void> {
    await this.db.update(agentRun).set({ endedAt: new Date(), outcome, error }).where(eq(agentRun.id, this.id));
  }
}
