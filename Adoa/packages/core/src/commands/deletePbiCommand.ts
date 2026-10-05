import { z } from "zod";
import type { Command } from "../models/Command";
import type { PbiJob } from "../models/PbiJob";
import { pbiDeleteProblem } from "../pbiAdmin";
import { PBI_QUEUE } from "../queues";

export const deletePbiCommand: Command<{ adoId: number }, { adoId: number }> = {
  name: "pbi.delete",
  description: "Delete a PBI from adoa only (its tasks, questions, runs, notes); sync won't import it again. ADO is not changed. Refused while an agent runs on it.",
  input: z.object({ adoId: z.number().int().positive() }),
  async run(context, input) {
    const problem = await pbiDeleteProblem(context.db, input.adoId);

    if (problem) {
      return { ok: false, error: problem };
    }

    const job: PbiJob = { action: "delete", adoId: input.adoId };

    await context.jobs.send(PBI_QUEUE, job);

    return { ok: true, value: { adoId: input.adoId } };
  },
};
