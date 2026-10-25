"use client";

import type { ChatTarget } from "@powerloom/core";
import { useState, useTransition } from "react";
import { openChatAction } from "@/app/chat/actions";

// Opens a chat on a target: the command prepares what the chat reads, then the browser follows the link into the agent
// app; a refusal stays as the message.
export function useOpenChat() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(target: ChatTarget) {
    startTransition(async () => {
      const result = await openChatAction(target);

      setMessage(result.ok ? null : result.message);

      if (result.link) {
        window.location.href = result.link;
      }
    });
  }

  return { open, isPending, message };
}
