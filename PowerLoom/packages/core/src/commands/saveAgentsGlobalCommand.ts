import { validateGlobal } from "@agenttools/config";
import { z } from "zod";
import type { Command } from "../models/Command";

// The Settings page's shared daily budget; AgentConfig validates the whole global record.
export const saveAgentsGlobalCommand: Command<{ dailyBudgetUsd: number }, { dailyBudgetUsd: number }> = {
  name: "agent.saveGlobal",
  description: "Set the daily budget all agents share (USD per UTC day); runs stop starting once it is spent. agent_global shows the current budget and today's spend. Show the user the current budget (agent_global) and the new one before calling.",
  input: z.object({ dailyBudgetUsd: z.number().min(0).describe("USD per UTC day for all agents together") }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "The agents' settings can't be changed from here (no agent store)." };
    }

    const checked = validateGlobal({ ...(await agents.getGlobal()), dailyBudgetUsd: input.dailyBudgetUsd });

    if (!checked.ok) {
      return { ok: false, error: checked.errors.join("; ") };
    }

    await agents.saveGlobal(checked.value);

    return { ok: true, value: { dailyBudgetUsd: checked.value.dailyBudgetUsd } };
  },
};
