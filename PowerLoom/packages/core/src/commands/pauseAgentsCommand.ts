import { z } from "zod";
import type { Command } from "../models/Command";

// The kill switch through AgentConfig (the Agents page's Pause all); resuming also clears a rate-limit pause.
export const pauseAgentsCommand: Command<{ paused: boolean }, { paused: boolean; pausedUntil: string | null }> = {
  name: "agent.pause",
  description: "Pause every agent (no new runs start; running ones finish) or resume them. Resuming also clears a pause a provider rate limit set. agent.global shows the current state.",
  input: z.object({ paused: z.boolean().describe("true pauses all agents, false resumes them") }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "Agents can't be paused from here (no agent store)." };
    }

    const global = await agents.getGlobal();
    const next = { ...global, paused: input.paused, pausedUntil: input.paused ? global.pausedUntil : null };

    await agents.saveGlobal(next);

    return { ok: true, value: { paused: next.paused, pausedUntil: next.pausedUntil } };
  },
};
