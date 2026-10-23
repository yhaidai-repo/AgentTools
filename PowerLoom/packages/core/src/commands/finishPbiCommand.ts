import { z } from "zod";
import type { Command } from "../models/Command";
import type { PbiFeedback } from "../models/PbiFeedback";

export const finishPbiCommand: Command<PbiFeedback, { message: string; wwwRecordId: number | null }> = {
  name: "pbi.finish",
  effect: "destructive",
  description: "Finish a PBI in PowerLoom (status done; its open items but findings are cancelled; ADO is not changed) with the user's feedback: the agents' rating 1–10, the hours the user spent, and optionally what went wrong (logged as a WWW record).",
  input: z.object({
    adoId: z.number().int().positive(),
    rating: z.number().int().min(1).max(10),
    effortHours: z.number().min(0).max(10_000),
    whatWentWrong: z.string().trim().transform((text) => text || null).nullable().default(null),
    fault: z.enum(["Human", "Agent"]).default("Agent"),
  }),
  async run(context, input) {
    const finished = await context.powerloom.finishPbi(input, context.actor);

    if (!finished.ok) {
      return finished;
    }

    return finished;
  },
};
