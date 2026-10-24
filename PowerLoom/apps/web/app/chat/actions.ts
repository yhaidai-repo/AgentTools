"use server";

import { openChatCommand, type ChatTarget } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ContinueResult } from "@/models/ContinueResult";

// "Continue with <agent>" on a PBI, an item or a review: the command prepares what the chat reads, then the browser opens
// the link in the agent app.
export async function openChatAction(target: ChatTarget): Promise<ContinueResult> {
  const opened = await runWebCommand(openChatCommand, { target });

  revalidatePath("/", "layout");

  return opened.ok ? { ok: true, message: "Opening the chat…", link: opened.value.url } : { ok: false, message: opened.error, link: null };
}
