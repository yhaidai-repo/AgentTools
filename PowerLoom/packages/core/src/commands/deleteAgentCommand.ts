import { isRemovable } from "@agenttools/config";
import { z } from "zod";
import { deletePromptVersions } from "../agents/promptVersions";
import type { Command } from "../models/Command";

// Only an agent made in the UI or by agent.create goes (origin `user`); the ones shipped with the code stay.
export const deleteAgentCommand: Command<{ id: string }, { id: string; label: string }> = {
  name: "agent.delete",
  effect: "destructive",
  description: "Delete an agent created by agent.create or the New agent page, with its stored prompt versions. An agent shipped with the code can't be deleted (disable it with agent.update instead). Its finished runs and results stay. Confirm with the user first, naming the agent, as the page's dialog does.",
  input: z.object({ id: z.string().trim().min(1).describe("The agent's id (agent.list)") }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "Agents can't be deleted from here (no agent store)." };
    }

    const agent = await agents.get(input.id);

    if (!agent) {
      return { ok: false, error: `No agent ${input.id} (agent.list names them).` };
    }

    if (!isRemovable(agent)) {
      return { ok: false, error: `${agent.label} is shipped with the code and can't be deleted; disable it with agent.update.` };
    }

    await agents.remove(agent.id);
    await deletePromptVersions(context.db, agent.id);

    return { ok: true, value: { id: agent.id, label: agent.label } };
  },
};
