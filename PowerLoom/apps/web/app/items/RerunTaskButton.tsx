"use client";

import { useState, useTransition } from "react";
import { rerunTaskAction } from "./actions";

// Reopens a finished agent task; it runs on the agent's next dispatch or "Run now". Re-run continues the last run's
// conversation when that run didn't succeed; Start over begins a fresh one (user decision 2026-10-19).
export function RerunTaskButton({ adoId, itemId }: { adoId: number | null; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onRerun(startOver: boolean) {
    startTransition(async () => {
      const result = await rerunTaskAction(adoId, itemId, startOver);

      setMessage(result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={() => onRerun(false)} disabled={isPending} title="Continues the last run's conversation if it didn't finish">{isPending ? "Reopening…" : "Re-run"}</button>
      <button type="button" className="secondary" onClick={() => onRerun(true)} disabled={isPending} title="Runs again from the start, without the last run's conversation">Start over</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}
