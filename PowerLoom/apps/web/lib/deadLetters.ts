import type { DeadLetter } from "@powerloom/core";
import { webCommandContext } from "./commandContext";

export type { DeadLetter };

// Messages PowerLoom gave up on (Wolverine's dead letters): the errors outside a single run, never hidden. None when
// PowerLoom refuses the read, as before the port.
export async function loadDeadLetters(from: Date): Promise<DeadLetter[]> {
  const outcome = await webCommandContext().powerloom.deadLetters(from);

  return outcome.ok ? outcome.value : [];
}
