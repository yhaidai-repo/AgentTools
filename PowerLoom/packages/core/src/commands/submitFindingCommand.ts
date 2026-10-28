import { z } from "zod";
import { startFindingSubmit } from "../findings";
import type { Command } from "../models/Command";
import type { SubmitFindingRequest } from "../models/SubmitFindingRequest";
import { recordContextFields, recordContextInput } from "./recordContext";

// The user's yes on a finding (the vault rules' "ask the user first"): PowerLoom adds the record to the project's
// register and closes the finding with the record's id.
export const submitFindingCommand: Command<SubmitFindingRequest, { itemId: string; register: string }> = {
  name: "finding.submit",
  description: "Submit a finding to the vault as an open question or a known issue of a project (its vault folder name), with the final title and text, the default (bullets) and, for a question, the options. PowerLoom writes the register record and closes the finding with its id. Show the user the final title, text, default and options first, as the finding form does, and call after their yes.",
  input: z.object({
    context: recordContextInput,
    itemId: z.string().min(1),
    adoId: z.number().int().positive().nullable(),
    type: z.enum(["question", "issue"]),
    project: z.string().trim().min(1),
    title: z.string().trim().transform((text) => text || null).nullable().default(null),
    text: z.string().trim().transform((text) => text || null).nullable().default(null),
    default: z.array(z.string()).default([]),
    options: z.array(z.string()).default([]),
  }),
  async run(context, input) {
    const started = await startFindingSubmit(context.db, { ...input, ...recordContextFields(context, input.context) });

    if (!started.ok) {
      return started;
    }

    await context.powerloom.addRecord(input.type === "issue" ? "known-issue" : "open-question", input.itemId);

    return { ok: true, value: { itemId: input.itemId, register: `${input.project}-${input.type === "issue" ? "known-issues" : "open-questions"}` } };
  },
};
