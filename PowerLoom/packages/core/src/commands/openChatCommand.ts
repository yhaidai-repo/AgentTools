import { z } from "zod";
import type { ChatLaunch } from "../models/ChatLaunch";
import type { ChatTarget } from "../models/ChatTarget";
import type { ChatDestination } from "../models/ChatDestination";
import type { Command } from "../models/Command";

export const openChatCommand: Command<{ target: ChatTarget; destination?: ChatDestination }, ChatLaunch> = {
  name: "chat.open",
  description: "Continue a PBI, question, human task, finding or PR review with an agent app, configure a vault, or import a PC folder. Omitted destination starts a new chat. destination selects an existing desktop conversation by launcher and conversationId; Claude returns clipboardText for the user to paste, Codex prefills it. Never send it automatically. Existing chats preserve the item's handoff note. A PBI moves to development, so confirm with the user first, naming the PBI or item.",
  input: z.object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("pbi"), adoId: z.number().int().positive() }),
      z.object({ kind: z.literal("item"), itemId: z.string().min(1) }),
      z.object({ kind: z.literal("review"), prId: z.number().int().positive() }),
      z.object({ kind: z.literal("vault"), vault: z.string().min(1) }),
      z.object({ kind: z.literal("import"), vault: z.string().min(1), folder: z.string().trim().min(1) }),
    ]),
    destination: z.object({
      launcher: z.enum(["claude-desktop", "codex-desktop"]),
      conversationId: z.string().min(1).max(100),
    }).optional(),
  }),
  run(context, input) {
    return context.powerloom.openChat(input.target, input.destination);
  },
};
