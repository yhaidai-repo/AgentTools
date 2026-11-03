import { z } from "zod";
import type { Command } from "../models/Command";
import type { Flow } from "../models/Flow";
import { readFlow } from "../flows";
import { flowIdInput } from "./flowInputs";
import { vaultInput } from "./inputs";

const input = z.object({ id: flowIdInput, vault: vaultInput });

type GetFlowInput = z.infer<typeof input>;

export const getFlowCommand: Command<GetFlowInput, Flow> = {
  name: "flow.get",
  effect: "read",
  description: "Read one flow by its id: name, version and the definition (trigger node, agent nodes with agent, kind and title, required and optional edges).",
  input,
  async run(context, input) {
    const flow = await readFlow(context.db, input.id, input.vault);

    return flow ? { ok: true, value: flow } : { ok: false, error: `Flow ${input.id} isn't in vault ${input.vault} (flow_list names them).` };
  },
};
