import { z } from "zod";
import type { Command } from "../models/Command";
import type { Flow } from "../models/Flow";
import { flowDefinitionSchema } from "../models/FlowDefinition";
import { flowIdInput } from "./flowInputs";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

const input = z.object({
  id: flowIdInput.nullable().default(null).describe("The flow to change (flow_list); null for a new one"),
  vault: vaultInput,
  name: z.string().trim().min(1).max(120).describe("The flow's name, unique in the vault"),
  definition: flowDefinitionSchema,
});

type SaveFlowInput = z.infer<typeof input>;

// The Flow app's Save: PowerLoom checks the definition (also that each node's kind is one its agent handles) and bumps
// the version of a changed flow; executions already running keep the definition they started with.
export const saveFlowCommand: Command<SaveFlowInput, Flow> = {
  name: "flow.save",
  description: "Create or change a flow: the trigger node, the agent nodes (agent, task kind, title) and the required or optional edges between them. A change bumps the flow's version; running executions keep their snapshot. Read it first with flow_get when changing one. Ask the user for whatever they didn't say (name, agents and kinds, what follows what) and show them the flow before saving.",
  input,
  async run(context, input) {
    return mapOutcome(await context.powerloom.saveFlow({ id: input.id, vault: input.vault, name: input.name, definition: input.definition }), (flow) => flow);
  },
};
