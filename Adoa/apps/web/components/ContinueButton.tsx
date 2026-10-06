"use client";

import type { ChatTarget } from "@adoa/core";
import { useState, useTransition } from "react";
import { openChatAction } from "@/app/chat/actions";

// "Continue with <agent>" (or "Configure with <agent>"): opens a new chat in the configured agent app; disabled with the
// reason while it can't.
export function ContinueButton({ target, label, problem, verb }: { target: ChatTarget; label: string; problem: string | null; verb: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onContinue() {
    startTransition(async () => {
      const result = await openChatAction(target);

      setMessage(result.ok ? null : result.message);

      if (result.link) {
        window.location.href = result.link;
      }
    });
  }

  return (
    <span className="actions">
      <button type="button" onClick={onContinue} disabled={isPending || problem !== null} title={problem ?? undefined}>{isPending ? "Opening…" : `${verb} with ${label}`}</button>
      {problem && <span className="muted">{problem}</span>}
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}
