import { z } from "zod";
import type { Command } from "../models/Command";
import type { ReportBugInput } from "../models/ReportBugInput";
import type { ReportedBug } from "../models/ReportedBug";

// An issue the user finds after design (user decision 2026-10-09): a child item of the PBI plus an internal bug record,
// prepared right away by PowerLoom, so its agents start like on a PBI.
export const reportBugCommand: Command<ReportBugInput, ReportedBug> = {
  name: "bug.report",
  description: "Report a bug of a PBI found after design: parent (Azure DevOps or PowerLoom link, #id or id), title, description in Markdown (steps, expected, actual). Creates a [BUG] child item that goes through refinement, research and design like a PBI. Ask the user for the steps, the expected and the actual result when they haven't given them; show the title and description before calling.",
  input: z.object({
    parent: z.string().trim().min(1),
    title: z.string().trim().min(1).max(240),
    descriptionMd: z.string().trim().transform((text) => text || null).nullable().default(null),
    priority: z.number().int().min(1).max(4).default(2),
  }),
  async run(context, input) {
    const reported = await context.powerloom.reportBug(input, context.actor);

    if (!reported.ok) {
      return reported;
    }

    return reported;
  },
};
