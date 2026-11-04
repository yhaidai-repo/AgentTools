import { z } from "zod";
import type { Command } from "../models/Command";
import type { FlowExecution } from "../models/FlowExecution";
import { readFlowExecution } from "../flows";
import { vaultInput } from "./inputs";

const input = z.object({
  id: z.string().trim().min(1).describe("The execution's id (FX-nnn, from flow_executions)"),
  vault: vaultInput,
});

type GetFlowExecutionInput = z.infer<typeof input>;

export const getFlowExecutionCommand: Command<GetFlowExecutionInput, FlowExecution> = {
  name: "flow.execution",
  effect: "read",
  description: "Read one flow execution: the flow and its version, the target, status (running, done, failed, cancelled), the definition it runs, and its steps: per agent node the task the engine created (id, status, runs, agent, kind), or pending / skipped.",
  input,
  async run(context, input) {
    const execution = await readFlowExecution(context.db, input.id, input.vault);

    return execution ? { ok: true, value: execution } : { ok: false, error: `Execution ${input.id} isn't in vault ${input.vault} (flow_executions lists them).` };
  },
};
