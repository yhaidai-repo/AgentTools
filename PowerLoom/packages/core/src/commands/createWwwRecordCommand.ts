import { z } from "zod";
import type { Command } from "../models/Command";
import type { NewWwwRecord } from "../models/NewWwwRecord";
import { recordContextFields, recordContextInput } from "./recordContext";

const optionalText = z.string().trim().min(1).nullable().default(null);

export const createWwwRecordCommand: Command<NewWwwRecord, { id: number }> = {
  name: "www.create",
  description: "Log a What-went-wrong record in a vault's www-log.md (the www-record skill's format). Fault is Human or Agent only. Fill it from what the user said: ask what was planned, what happened, whose fault and the root cause when unclear; never invent them, and show the record before calling.",
  input: z.object({
    context: recordContextInput,
    vault: z.string().regex(/^\w[\w .-]*$/, "a vault folder name under the vaults root"),
    source: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    kind: z.enum(["complaint", "notice"]),
    project: z.string().trim().min(1),
    planned: z.string().trim().min(1),
    happened: z.string().trim().min(1),
    fault: z.enum(["Human", "Agent"]),
    rootCause: optionalText,
    resolution: optionalText,
    preventiveAction: optionalText,
    assumptions: optionalText,
  }),
  async run(context, input) {
    const created = await context.powerloom.createWwwRecord({ ...input, ...recordContextFields(context, input.context) });

    return created.ok ? { ok: true, value: { id: created.value } } : created;
  },
};
