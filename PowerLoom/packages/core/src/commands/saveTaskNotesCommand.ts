import { z } from "zod";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

// The test task page's Notes (user decision 2026-10-21): the Autotest agent reads the current notes on every run.
export const saveTaskNotesCommand: Command<{ itemId: string; text: string; loadedText: string }, { text: string }> = {
  name: "task.notes.save",
  description: "Replace the user's notes on a test task (the Autotest agent reads them on every run; test tasks only, up to 8000 characters). Read them first with task.get (data.userNotes) and pass that as loadedText (a stale one is refused). Show the user the final text and save after their yes.",
  input: z.object({
    itemId: z.string().trim().min(1).describe("The test task's id"),
    text: z.string().describe("The whole new notes text"),
    loadedText: z.string().describe("The notes task.get answered"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.saveTaskNotes(input.itemId, input.text, input.loadedText), (text) => ({ text }));
  },
};
