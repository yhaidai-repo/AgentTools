import { z } from "zod";
import type { Command } from "../models/Command";
import type { CreatePbiInput } from "../models/CreatePbiInput";

const PBI_TYPES = ["Product Backlog Item", "Bug", "Task"] as const;

export const createPbiCommand: Command<CreatePbiInput, { adoId: number }> = {
  name: "pbi.create",
  description: "Create a PBI in PowerLoom itself (no Azure DevOps counterpart): title, type, priority, description and acceptance criteria in Markdown. With parentId it is a child item of that PBI, in the parent's vault (vault may then be left out). Prepare it for refinement afterwards. Ask the user for the title, description and acceptance criteria when missing, confirm the type and priority, and show the PBI before calling.",
  input: z.object({
    vault: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(255),
    type: z.enum(PBI_TYPES).default("Product Backlog Item"),
    priority: z.number().int().min(1).max(4).default(2),
    descriptionMd: z.string().trim().transform((text) => text || null).nullable().default(null),
    acceptanceCriteriaMd: z.string().trim().transform((text) => text || null).nullable().default(null),
    parentId: z.number().int().positive().nullable().default(null),
  }),
  async run(context, input) {
    return context.powerloom.createPbi(input, context.actor);
  },
};
