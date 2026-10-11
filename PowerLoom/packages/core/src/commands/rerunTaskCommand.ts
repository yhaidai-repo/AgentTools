import { z } from "zod";
import type { Command } from "../models/Command";

export const rerunTaskCommand: Command<{ adoId: number | null; itemId: string }, { itemId: string }> = {
  name: "task.rerun",
  description: "Open a finished, failed or blocked agent task again; it runs on its agent's next schedule or Run now.",
  input: z.object({ adoId: z.number().int().positive().nullable(), itemId: z.string().min(1) }),
  async run(context, input) {
    const reopened = await context.powerloom.rerunTask(input.adoId, input.itemId);

    if (!reopened.ok) {
      return reopened;
    }

    return { ok: true, value: { itemId: input.itemId } };
  },
};
