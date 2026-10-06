import { z } from "zod";
import { createLocalPbi } from "../localPbis";
import type { Command } from "../models/Command";
import { readVault } from "../vaults";

const PBI_TYPES = ["Product Backlog Item", "Bug", "Task"] as const;

export const createPbiCommand: Command<{ vault: string; title: string; type: string; priority: number; descriptionMd: string | null; acceptanceCriteriaMd: string | null }, { adoId: number }> = {
  name: "pbi.create",
  description: "Create a PBI in adoa itself (no Azure DevOps counterpart) in a vault: title, type, priority, description and acceptance criteria in Markdown. Prepare it for refinement afterwards.",
  input: z.object({
    vault: z.string().min(1),
    title: z.string().trim().min(1).max(255),
    type: z.enum(PBI_TYPES).default("Product Backlog Item"),
    priority: z.number().int().min(1).max(4).default(2),
    descriptionMd: z.string().trim().transform((text) => text || null).nullable().default(null),
    acceptanceCriteriaMd: z.string().trim().transform((text) => text || null).nullable().default(null),
  }),
  async run(context, input) {
    if (!(await readVault(context.db, input.vault))) {
      return { ok: false, error: `${input.vault} isn't a vault.` };
    }

    return { ok: true, value: { adoId: await createLocalPbi(context.db, context.actor, input) } };
  },
};
