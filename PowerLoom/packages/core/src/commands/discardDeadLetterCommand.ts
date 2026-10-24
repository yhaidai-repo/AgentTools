import { z } from "zod";
import type { Command } from "../models/Command";
import { deadLetterIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const discardDeadLetterCommand: Command<{ id: string }, { id: string }> = {
  name: "deadletter.discard",
  effect: "destructive",
  description: "Drop a dead letter for good: what it would have done never happens. Confirm with the user first, naming the message and its error.",
  input: z.object({ id: deadLetterIdInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.discardDeadLetter(input.id), (id) => ({ id }));
  },
};
