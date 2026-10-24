import { z } from "zod";
import type { Command } from "../models/Command";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const getPbiUserNotesCommand: Command<{ adoId: number }, { text: string }> = {
  name: "pbi.userNotes.get",
  effect: "read",
  description: "The user's own notes on a PBI (the PBI note's Notes section, which the agents read). Pass the text as loadedText when saving.",
  input: z.object({ adoId: pbiIdInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.pbiUserNotes(input.adoId), (text) => ({ text }));
  },
};
