"use client";

import type { ChatTarget } from "@powerloom/core";
import { useState } from "react";
import { useOpenChat } from "./useOpenChat";
import { ChatPicker } from "./ChatPicker";

// "Continue with <agent>" (or "Configure with <agent>"): opens a new chat in the configured agent app; disabled with the
// reason while it can't.
export function ContinueButton({ target, label, problem, verb }: { target: ChatTarget; label: string; problem: string | null; verb: string }) {
  const launch = useOpenChat();
  const { open, isPending, message, notice } = launch;
  const [picking, setPicking] = useState(false);
  const canPick = target.kind !== "vault" && target.kind !== "import";

  function closePicker() { launch.reset(false); setPicking(false); }

  return (
    <span className="actions">
      <button type="button" onClick={() => { launch.reset(); if (canPick) setPicking(true); else void open(target); }} disabled={isPending || problem !== null} title={problem ?? undefined}>{isPending ? "Opening…" : `${verb} with ${label}`}</button>
      {problem && <span className="muted">{problem}</span>}
      {message && !picking && <span className="result-error" role="alert">{message}</span>}
      {notice && <span role="status">{notice}</span>}
      {picking && <ChatPicker target={target} label={label} launch={launch} onClose={closePicker} />}
    </span>
  );
}
