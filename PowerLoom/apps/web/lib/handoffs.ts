import { handoffChatSection, loadHandoffContext } from "@powerloom/core";
import { getDb } from "./db";

// The hand-offs into an item as a person reads them: each sender's package, then how what it waits for closed; null
// when no hand-off touches it.
export async function loadHandoffSection(item: { id: string; data: unknown }): Promise<string | null> {
  const context = await loadHandoffContext(getDb(), item, null);

  return handoffChatSection(context);
}
