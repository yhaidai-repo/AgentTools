import type { DeadLetter } from "@powerloom/core";
import { webCommandContext } from "./commandContext";

export type { DeadLetter };

// Messages PowerLoom gave up on. An unavailable queue is distinct from an empty one.
export async function loadDeadLetters(from: Date): Promise<DeadLetter[] | null> {
  try {
    const outcome = await webCommandContext().powerloom.deadLetters(from);

    return outcome.ok ? outcome.value : null;
  } catch {
    return null;
  }
}
