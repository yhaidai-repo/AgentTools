import { z } from "zod";
import type { Command } from "../models/Command";
import type { FlowExecution } from "../models/FlowExecution";
import { flowExecutionIdInput } from "./flowInputs";
import { mapOutcome } from "./mapOutcome";

export const cancelFlowExecutionCommand: Command<{ id: string }, FlowExecution> = {
  name: "flow.cancel",
  description: "Cancel a running flow execution: it is marked cancelled and finished now; tasks it already created stay as they are. Confirm with the user first, naming the execution.",
  input: z.object({ id: flowExecutionIdInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.cancelFlowExecution(input.id), (execution) => execution);
  },
};
