import { localItem } from "@powerloom/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { humanTaskResolution, isHumanTaskData } from "../humanTasks";
import { itemOfPbi, pbiLabel } from "../itemScope";
import type { CloseItemInput } from "../models/CloseItemInput";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { ItemStatus } from "../models/ItemStatus";
import type { Outcome } from "../models/Outcome";

export const closeItemCommand: Command<CloseItemInput, { status: ItemStatus }> = {
  name: "item.close",
  description: "Close a question or finding (answer / dismiss) or a human task (done / cancel) with the person's answer or result. A human task with steps takes one answer per step in `answers` (\"\" skips a step); `resolution` is the answer of a question or finding, or the task's note.",
  input: z.object({
    itemId: z.string().min(1),
    adoId: z.number().int().positive().nullable(),
    decision: z.enum(["answer", "dismiss", "done", "cancel"]),
    resolution: z.string().trim().transform((text) => text || null).nullable().default(null),
    answers: z.array(z.string()).default([]),
    hasAttachment: z.boolean().default(false),
  }),
  async run(context, input) {
    const resolution = await resolutionOf(context, input);

    if (!resolution.ok) {
      return resolution;
    }

    return context.powerloom.closeItem({ ...input, resolution: resolution.value });
  },
};

// A structured human task's resolution is its per-step answers plus the note; every other item keeps the note.
async function resolutionOf(context: CommandContext, input: CloseItemInput): Promise<Outcome<string | null>> {
  if (input.answers.length === 0) {
    return { ok: true, value: input.resolution };
  }

  const [item] = await context.db.select().from(localItem).where(and(eq(localItem.id, input.itemId), itemOfPbi(input.adoId)));

  if (!item) {
    return { ok: false, error: `${input.itemId} is not an item of ${pbiLabel(input.adoId)}.` };
  }

  if (!isHumanTaskData(item.data)) {
    return { ok: false, error: `${input.itemId} has no steps to answer; give the answer as resolution.` };
  }

  return { ok: true, value: humanTaskResolution(item.data, input.answers, input.resolution) };
}
