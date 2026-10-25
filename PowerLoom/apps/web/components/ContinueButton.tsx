"use client";

import type { ChatTarget } from "@powerloom/core";
import { useOpenChat } from "./useOpenChat";

// "Continue with <agent>" (or "Configure with <agent>"): opens a new chat in the configured agent app; disabled with the
// reason while it can't.
export function ContinueButton({ target, label, problem, verb }: { target: ChatTarget; label: string; problem: string | null; verb: string }) {
  const { open, isPending, message } = useOpenChat();

  return (
    <span className="actions">
      <button type="button" onClick={() => open(target)} disabled={isPending || problem !== null} title={problem ?? undefined}>{isPending ? "Opening…" : `${verb} with ${label}`}</button>
      {problem && <span className="muted">{problem}</span>}
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}
