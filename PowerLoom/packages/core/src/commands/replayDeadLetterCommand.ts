import { z } from "zod";
import type { Command } from "../models/Command";
import { deadLetterIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Agents page's dead letters: put back on its queue (PowerLoom's durability agent picks it up).
export const replayDeadLetterCommand: Command<{ id: string }, { id: string }> = {
  name: "deadletter.replay",
  description: "Put a dead letter (a message PowerLoom gave up on) back on its queue, so it runs again in a moment. Ask the user which one when they didn't say (deadletter_list).",
  input: z.object({ id: deadLetterIdInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.replayDeadLetter(input.id), (id) => ({ id }));
  },
};
