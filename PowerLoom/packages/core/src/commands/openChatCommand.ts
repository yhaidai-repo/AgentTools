import { localItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { loadHandoffContext } from "../handoffs/handoffContext";
import { handoffChatSection } from "../handoffs/renderHandoff";
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
  async run(context, input) {
    return context.powerloom.openChat(input.target, input.destination, await handoffSectionOf(context.db, input.target));
  },
};

// An item's hand-offs go into its chat note, rendered as the agents read them (user decision 2026-10-28).
async function handoffSectionOf(db: PowerLoomDb, target: ChatTarget): Promise<string | null> {
  if (target.kind !== "item") {
    return null;
  }

  const [item] = await db.select({ id: localItem.id, data: localItem.data }).from(localItem).where(eq(localItem.id, target.itemId));

  return item ? handoffChatSection(await loadHandoffContext(db, item, null)) : null;
}
