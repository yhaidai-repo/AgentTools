import { z } from "zod";
import { closeHumanItem, findClosableItem } from "../humanItems";
import type { CloseItemRequest } from "../models/CloseItemRequest";
import type { Command } from "../models/Command";
import type { ItemStatus } from "../models/ItemStatus";
import { notifyChange } from "./notifyChange";

export const closeItemCommand: Command<CloseItemRequest, { status: ItemStatus }> = {
  name: "item.close",
  description: "Close a question or finding (answer / dismiss) or a human task (done / cancel) with the person's answer or result.",
  input: z.object({
    itemId: z.string().min(1),
    adoId: z.number().int().positive().nullable(),
    decision: z.enum(["answer", "dismiss", "done", "cancel"]),
    resolution: z.string().trim().transform((text) => text || null).nullable().default(null),
    hasAttachment: z.boolean().default(false),
  }),
  async run(context, input) {
    const found = await findClosableItem(context.db, input);

    if (!found.ok) {
      return found;
    }

    const status = await closeHumanItem(context.db, found.value, input);

    await notifyChange(context, input.adoId);

    return { ok: true, value: { status } };
  },
};
