import { z } from "zod";
import type { Command } from "../models/Command";
import type { FlowExecution } from "../models/FlowExecution";
import type { FlowTarget } from "../models/FlowTarget";
import { flowIdInput } from "./flowInputs";
import { pbiIdInput, vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

const input = z.object({
  id: flowIdInput,
  vault: vaultInput,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("pbi"), pbiId: pbiIdInput }),
    z.object({ kind: z.literal("task"), itemId: z.string().trim().min(1).describe("The task's id, e.g. GT-001 (task_list)") }),
  ]).describe("What the flow runs for: a PBI or a task of the vault"),
});

type RunFlowInput = z.infer<typeof input>;

// Phase 1 records the execution with the flow's current definition; phase 2's engine creates the nodes' tasks from it.
export const runFlowCommand: Command<RunFlowInput, FlowExecution> = {
  name: "flow.run",
  description: "Run a flow for a PBI or a task of its vault: records an execution with the flow as it is now (the tasks of its agent nodes follow once the flow engine exists). Confirm with the user first, naming the flow and the target.",
  input,
  async run(context, input) {
    return mapOutcome(await context.powerloom.runFlow(input.id, input.vault, input.target as FlowTarget), (execution) => execution);
  },
};
