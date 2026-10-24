import { z } from "zod";
import type { Command } from "../models/Command";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The PBI page's Notes: the user's own section of the PBI note, read by the agents with the note.
export const savePbiUserNotesCommand: Command<{ adoId: number; text: string; loadedText: string }, { text: string }> = {
  name: "pbi.userNotes.save",
  description: "Replace the user's own notes on a PBI (the PBI note's Notes section; the next agent runs read it). Read them first with pbi.userNotes.get and pass that text as loadedText (a stale one is refused). Show the user the final text and save after their yes.",
  input: z.object({
    adoId: pbiIdInput,
    text: z.string().describe("The whole new notes text"),
    loadedText: z.string().describe("The text pbi.userNotes.get answered"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.savePbiUserNotes(input.adoId, input.text, input.loadedText), (text) => ({ text }));
  },
};
