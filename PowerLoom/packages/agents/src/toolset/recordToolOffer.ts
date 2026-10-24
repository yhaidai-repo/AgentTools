import { saveToolOffer, type OfferedTool } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";

/** Saves what a run or a chat session was given, for the Tools tab; a failed save never stops the run or the session. */
export async function recordToolOffer(db: PowerLoomDb, vault: string, holder: string, tools: OfferedTool[]): Promise<void> {
  try {
    await saveToolOffer(db, vault, holder, tools);
  } catch (error) {
    console.error(`tools offered to ${holder} in ${vault} not recorded: ${error instanceof Error ? error.message : String(error)}`);
  }
}
