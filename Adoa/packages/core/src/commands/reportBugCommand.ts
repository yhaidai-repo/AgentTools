import { z } from "zod";
import { recordBug } from "../bugs/bugRecords";
import { BUG_WORK_ITEM_TYPE, bugTitle } from "../bugs/bugRule";
import { topLevelPbi } from "../bugs/childItems";
import { createLocalPbi } from "../localPbis";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { Outcome } from "../models/Outcome";
import type { ParentPbi } from "../models/ParentPbi";
import type { ReportBugInput } from "../models/ReportBugInput";
import type { ReportedBug } from "../models/ReportedBug";
import { parsePbiReference } from "../pbiAdmin";
import { notifyChange } from "./notifyChange";

// An issue the user finds after design (user decision 2026-10-09): a child item of the PBI plus an internal bug record.
// The dispatcher prepares it on its next tick, so its agents start like on a PBI.
export const reportBugCommand: Command<ReportBugInput, ReportedBug> = {
  name: "bug.report",
  description: "Report a bug of a PBI found after design: parent (Azure DevOps or adoa link, #id or id), title, description in Markdown (steps, expected, actual). Creates a [BUG] child item that goes through refinement, research and design like a PBI.",
  input: z.object({
    parent: z.string().trim().min(1),
    title: z.string().trim().min(1).max(240),
    descriptionMd: z.string().trim().transform((text) => text || null).nullable().default(null),
    priority: z.number().int().min(1).max(4).default(2),
  }),
  async run(context, input) {
    const parent = await resolveParent(context, input.parent);

    if (!parent.ok) {
      return parent;
    }

    const adoId = await createBugItem(context, parent.value, input);

    await recordBug(context.db, { workItemId: adoId, pbiId: parent.value.adoId, source: "internal", reportedBy: context.actor });
    await notifyChange(context, parent.value.adoId);

    return { ok: true, value: { adoId, parentId: parent.value.adoId } };
  },
};

// The PBI the bug is filed under; a link to a child item files it under that child's parent.
async function resolveParent(context: CommandContext, reference: string): Promise<Outcome<ParentPbi>> {
  const adoId = parsePbiReference(reference);

  if (adoId === null) {
    return { ok: false, error: `Not a PBI link or id: ${reference}` };
  }

  const parent = await topLevelPbi(context.db, adoId);

  return parent ? { ok: true, value: parent } : { ok: false, error: `PBI-${adoId} isn't in adoa.` };
}

function createBugItem(context: CommandContext, parent: ParentPbi, input: ReportBugInput): Promise<number> {
  return createLocalPbi(context.db, context.actor, {
    vault: parent.vault,
    title: bugTitle(input.title),
    type: BUG_WORK_ITEM_TYPE,
    priority: input.priority,
    descriptionMd: input.descriptionMd,
    acceptanceCriteriaMd: null,
    parentId: parent.adoId,
  });
}
