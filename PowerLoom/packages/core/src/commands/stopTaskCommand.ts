import { z } from "zod";
import type { Command } from "../models/Command";

export const stopTaskCommand: Command<{ itemId: string }, { itemId: string }> = {
  name: "task.stop",
  description: "Stop an agent task's run that is in progress, as the run page's Stop does: the agent ends at once, the run keeps its result (or its last words as a partial result) and the task is blocked until it is re-run (task_rerun continues from what the run kept). Confirm with the user first.",
  input: z.object({ itemId: z.string().min(1) }),
  async run(context, input) {
    const stopped = await context.powerloom.stopTask(input.itemId);

    return stopped.ok ? { ok: true, value: { itemId: input.itemId } } : stopped;
  },
};
