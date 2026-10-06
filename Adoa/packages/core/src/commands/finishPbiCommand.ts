import { z } from "zod";
import { recordPbiFeedback } from "../feedback/recordPbiFeedback";
import { finishPbi } from "../finishPbi";
import type { Command } from "../models/Command";
import type { PbiFeedback } from "../models/PbiFeedback";
import { notifyChange } from "./notifyChange";

export const finishPbiCommand: Command<PbiFeedback, { message: string; wwwRecordId: number | null }> = {
  name: "pbi.finish",
  description: "Finish a PBI in adoa (status done; its open agent tasks are cancelled; ADO is not changed) with the user's feedback: the agents' rating 1–10, the hours the user spent, and optionally what went wrong (logged as a WWW record).",
  input: z.object({
    adoId: z.number().int().positive(),
    rating: z.number().int().min(1).max(10),
    effortHours: z.number().min(0).max(10_000),
    whatWentWrong: z.string().trim().transform((text) => text || null).nullable().default(null),
    fault: z.enum(["Human", "Agent"]).default("Agent"),
  }),
  async run(context, input) {
    const finished = await finishPbi(context.db, input.adoId, context.actor);

    if (!finished.ok) {
      return finished;
    }

    const wwwRecordId = await recordPbiFeedback(context, input);

    await notifyChange(context, input.adoId);

    return { ok: true, value: { message: finished.value, wwwRecordId } };
  },
};
