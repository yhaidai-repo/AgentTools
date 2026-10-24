import { z } from "zod";
import type { Command } from "../models/Command";

// The Agents page's Run now: PowerLoom validates the agent's open tasks and starts the valid ones, as its schedule would.
export const runAgentCommand: Command<{ id: string }, { agentId: string; message: string }> = {
  name: "agent.run",
  description: "Run an agent now, as its schedule would: PowerLoom checks the agent's open tasks and starts the valid ones (held tasks keep their reasons, see task.list). Answers at once; run.list shows what started. Confirm with the user first, naming the agent.",
  input: z.object({ id: z.string().trim().min(1).describe("The agent's id (agent.list)") }),
  async run(context, input) {
    const agent = await context.agents?.get(input.id);

    if (!agent) {
      return { ok: false, error: `No agent ${input.id} (agent.list names them).` };
    }

    const dispatched = await context.powerloom.runAgent(agent.id);

    if (!dispatched.ok) {
      return dispatched;
    }

    return { ok: true, value: { agentId: dispatched.value.agentId, message: `${agent.label}: its open tasks are being checked and started.` } };
  },
};
