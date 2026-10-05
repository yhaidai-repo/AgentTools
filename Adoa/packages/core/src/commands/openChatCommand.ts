import { z } from "zod";
import { chatPlan } from "../continue/chatPlan";
import type { ChatLaunch } from "../models/ChatLaunch";
import type { ChatTarget } from "../models/ChatTarget";
import type { Command } from "../models/Command";

export const openChatCommand: Command<{ target: ChatTarget }, ChatLaunch> = {
  name: "chat.open",
  description: "Continue a PBI, question, human task, finding or PR review with an agent app (model agnostic): returns the link that opens a new chat with its context. A PBI moves to development.",
  input: z.object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("pbi"), adoId: z.number().int().positive() }),
      z.object({ kind: z.literal("item"), itemId: z.string().min(1) }),
      z.object({ kind: z.literal("review"), prId: z.number().int().positive() }),
    ]),
  }),
  async run(context, input) {
    const planned = await chatPlan(context, input.target);

    if (!planned.ok) {
      return planned;
    }

    // The link is built before anything changes, so a request the app can't take leaves no status change behind.
    const launch = planned.value.launcher.open(planned.value.plan.request);

    if (!launch.ok) {
      return launch;
    }

    const problem = await planned.value.plan.prepare(context);

    return problem ? { ok: false, error: problem } : launch;
  },
};
