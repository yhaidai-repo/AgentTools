"use server";

import { openChatCommand, type ChatTarget, type ChatDestination } from "@powerloom/core";
import { problemDetail, type components } from "@powerloom/client";
import { powerloom } from "@/lib/powerloom";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ContinueResult } from "@/models/ContinueResult";

// "Continue with <agent>" on a PBI, an item or a review: the command prepares what the chat reads, then the browser opens
// the link in the agent app.
export async function openChatAction(target: ChatTarget, destination?: ChatDestination): Promise<ContinueResult> {
  const opened = await runWebCommand(openChatCommand, { target, destination });

  revalidatePath("/", "layout");

  return opened.ok ? { ok: true, message: "Opening the chat…", link: opened.value.url, clipboardText: opened.value.clipboardText } : { ok: false, message: opened.error, link: null };
}

export async function chatConversationsAction(target: ChatTarget, search: string): Promise<{ data?: components["schemas"]["ChatConversationChoices"]; error?: string }> {
  if (target.kind === "vault" || target.kind === "import") return { error: "This action starts a new chat." };

  const id = target.kind === "pbi" ? String(target.adoId) : target.kind === "review" ? String(target.prId) : target.itemId;
  const { data, error, response } = await powerloom.GET("/api/chats/conversations", { params: { query: { kind: target.kind, id, search } } });

  return data ? { data } : { error: problemDetail(error, response) };
}
