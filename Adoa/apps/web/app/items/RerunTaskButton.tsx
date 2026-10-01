"use client";

import { useState, useTransition } from "react";
import { rerunTaskAction } from "./actions";

// Reopens a finished agent task; it runs on the agent's next dispatch or "Run now".
export function RerunTaskButton({ adoId, itemId }: { adoId: number | null; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onRerun() {
    startTransition(async () => {
      const result = await rerunTaskAction(adoId, itemId);

      setMessage(result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onRerun} disabled={isPending}>{isPending ? "Reopening…" : "Re-run"}</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}
