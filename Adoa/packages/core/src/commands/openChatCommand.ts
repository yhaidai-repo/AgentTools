import { z } from "zod";
import type { ChatLaunch } from "../models/ChatLaunch";
import type { ChatTarget } from "../models/ChatTarget";
import type { Command } from "../models/Command";

export const openChatCommand: Command<{ target: ChatTarget }, ChatLaunch> = {
  name: "chat.open",
  description: "Continue a PBI, question, human task, finding or PR review with an agent app (model agnostic), or configure a vault for it: returns the link that opens a new chat with its context. A PBI moves to development.",
  input: z.object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("pbi"), adoId: z.number().int().positive() }),
      z.object({ kind: z.literal("item"), itemId: z.string().min(1) }),
      z.object({ kind: z.literal("review"), prId: z.number().int().positive() }),
      z.object({ kind: z.literal("vault"), vault: z.string().min(1) }),
    ]),
  }),
  run(context, input) {
    return context.powerloom.openChat(input.target);
  },
};
