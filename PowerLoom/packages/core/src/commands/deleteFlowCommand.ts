import { z } from "zod";
import type { Command } from "../models/Command";
import { flowIdInput } from "./flowInputs";
import { mapOutcome } from "./mapOutcome";

export const deleteFlowCommand: Command<{ id: string }, { id: string; name: string }> = {
  name: "flow.delete",
  effect: "destructive",
  description: "Delete a flow and its finished executions; refused while one of them runs (cancel it first). Confirm with the user first, naming the flow.",
  input: z.object({ id: flowIdInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.deleteFlow(input.id), (name) => ({ id: input.id, name }));
  },
};
