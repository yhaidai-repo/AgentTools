import { z } from "zod";
import { topLevelPbi } from "../bugs/childItems";
import { createLocalPbi } from "../localPbis";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { CreatePbiInput } from "../models/CreatePbiInput";
import type { Outcome } from "../models/Outcome";
import type { PbiTarget } from "../models/PbiTarget";
import { readVault } from "../vaults";

const PBI_TYPES = ["Product Backlog Item", "Bug", "Task"] as const;

export const createPbiCommand: Command<CreatePbiInput, { adoId: number }> = {
  name: "pbi.create",
  description: "Create a PBI in adoa itself (no Azure DevOps counterpart): title, type, priority, description and acceptance criteria in Markdown. With parentId it is a child item of that PBI, in the parent's vault (vault may then be left out). Prepare it for refinement afterwards.",
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
    const target = await resolveTarget(context, input);

    if (!target.ok) {
      return target;
    }

    const adoId = await createLocalPbi(context.db, context.actor, { ...input, vault: target.value.vault, parentId: target.value.parentId });

    return { ok: true, value: { adoId } };
  },
};

// Where the new PBI goes: the named vault, or for a child its parent's (one level: a child's child goes to the top PBI).
async function resolveTarget(context: CommandContext, input: CreatePbiInput): Promise<Outcome<PbiTarget>> {
  if (input.parentId === null) {
    return resolveVault(context, input.vault);
  }

  const parent = await topLevelPbi(context.db, input.parentId);

  if (!parent) {
    return { ok: false, error: `PBI-${input.parentId} isn't in adoa.` };
  }

  if (input.vault && input.vault !== parent.vault) {
    return { ok: false, error: `PBI-${parent.adoId} is in ${parent.vault}, not in ${input.vault}.` };
  }

  return { ok: true, value: { vault: parent.vault, parentId: parent.adoId } };
}

async function resolveVault(context: CommandContext, vault: string | undefined): Promise<Outcome<PbiTarget>> {
  if (!vault || !(await readVault(context.db, vault))) {
    return { ok: false, error: vault ? `${vault} isn't a vault.` : "Name a vault, or a parentId for a child item." };
  }

  return { ok: true, value: { vault, parentId: null } };
}
