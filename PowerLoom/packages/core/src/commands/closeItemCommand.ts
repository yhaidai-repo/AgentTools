import { z } from "zod";
import type { CloseItemRequest } from "../models/CloseItemRequest";
import type { Command } from "../models/Command";
import type { ItemStatus } from "../models/ItemStatus";

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
    const closed = await context.powerloom.closeItem(input);

    if (!closed.ok) {
      return closed;
    }

    return closed;
  },
};
