import { z } from "zod";
import type { Command } from "../models/Command";
import type { FlowExecution } from "../models/FlowExecution";
import { readFlowExecutions } from "../flows";
import { flowIdInput } from "./flowInputs";
import { limitInput, vaultInput } from "./inputs";

const input = z.object({
  vault: vaultInput,
  flowId: flowIdInput.nullable().default(null).describe("Only this flow's executions; null for the vault's"),
  limit: limitInput(200, 50),
});

type ListFlowExecutionsInput = z.infer<typeof input>;

export const listFlowExecutionsCommand: Command<ListFlowExecutionsInput, FlowExecution[]> = {
  name: "flow.executions",
  effect: "read",
  description: "List a vault's flow executions, newest first: the flow and its version, the target (PBI or task), status (running, done, failed, cancelled), when it started and finished, and the definition it runs.",
  input,
  async run(context, input) {
    return { ok: true, value: await readFlowExecutions(context.db, input.vault, { flowId: input.flowId, limit: input.limit }) };
  },
};
