import { z } from "zod";
import type { Command } from "../models/Command";

// The Agents page's Run now: PowerLoom validates the agent's open tasks and starts the valid ones, as its schedule would.
export const runAgentCommand: Command<{ id: string }, { agentId: string; openTasks: number; message: string }> = {
  name: "agent.run",
  description: "Run an agent now, as its schedule would: PowerLoom checks the agent's open tasks and starts the valid ones (held tasks keep their reasons, see task_list). Answers at once with how many open tasks it checks, or why nothing starts (agent disabled, agents paused, no open task of its types); run_list shows what started. Confirm with the user first, naming the agent.",
  input: z.object({ id: z.string().trim().min(1).describe("The agent's id (agent_list)") }),
  async run(context, input) {
    const agent = await context.agents?.get(input.id);

    if (!agent) {
      return { ok: false, error: `No agent ${input.id} (agent.list names them).` };
    }

    // PowerLoom says what happens: how many open tasks it checks, or why nothing starts (disabled, paused, none open).
    return context.powerloom.runAgent(agent.id);
  },
};
