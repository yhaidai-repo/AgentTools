import type { DeadLetter } from "@powerloom/core";
import { webCommandContext } from "./commandContext";

export type { DeadLetter };

// Messages PowerLoom gave up on, newest first. An unavailable queue is distinct from an empty one.
export async function loadDeadLetters(): Promise<DeadLetter[] | null> {
  try {
    const outcome = await webCommandContext().powerloom.deadLetters(new Date(0));

    return outcome.ok ? [...outcome.value].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()) : null;
  } catch {
    return null;
  }
}
