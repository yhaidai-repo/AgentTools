import { z } from "zod";
import type { Command } from "../models/Command";
import { noHeadingLinesInput, oneLineInput, vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";
import type { RegisterRecordInput } from "../models/RegisterRecordInput";
import { recordContextFields, recordContextInput } from "./recordContext";

// record_finding for a chat (stage 5, MCPQ-008): the user is here to say yes, so the record goes into the register at once.
export const addRegisterRecordCommand: Command<RegisterRecordInput & { vault: string }, { id: string }> = {
  name: "register.add",
  description: "Record something only a person can settle in a project's register: an open question (business rule, missing spec, docs vs code) or a known issue (a likely defect), in the vault rules' format. Check vault_registers first so it isn't recorded twice. Show the user the record (title, text, defaults, options) and add it after their yes.",
  input: z.object({
    context: recordContextInput,
    vault: vaultInput,
    project: z.string().trim().min(1).describe("The project key, e.g. shop"),
    kind: z.enum(["questions", "issues"]).describe("questions: an open question (OQ); issues: a known issue (KI)"),
    title: oneLineInput.describe("A question for questions, a short defect name for issues"),
    text: noHeadingLinesInput.describe("1-3 lines: what and why it matters, with the symbols involved"),
    default: z.array(oneLineInput).default([]).describe("Questions: what holds until it is answered; issues: the workaround"),
    options: z.array(oneLineInput).default([]).describe("Questions: the possible answers"),
  }),
  async run(context, input) {
    const { vault, ...record } = input;

    return mapOutcome(await context.powerloom.addRegisterRecord(vault, { ...record, ...recordContextFields(context, input.context) }), (id) => ({ id }));
  },
};
