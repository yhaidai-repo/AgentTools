import { z } from "zod";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

// The item page's Delete: a question or task goes to the trash of PowerLoom's items (soft-deleted).
export const deleteItemCommand: Command<{ adoId: number | null; itemId: string }, { itemId: string }> = {
  name: "item.delete",
  effect: "destructive",
  description: "Delete a question or task (soft-deleted: it leaves the lists and the agents no longer see it). Confirm with the user first, naming the item and its PBI.",
  input: z.object({
    adoId: z.number().int().positive().nullable().describe("The item's PBI; null for a task without one"),
    itemId: z.string().trim().min(1).describe("The item's id, e.g. Q-38519-002"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.deleteItem(input.adoId, input.itemId), (itemId) => ({ itemId }));
  },
};
