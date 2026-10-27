"use client";

import { useState, useTransition } from "react";
import { stopTaskAction } from "./actions";

// Stops a task's run in progress (user decision 2026-10-26): the agent ends at once, the run keeps its result (or its
// last words as a partial one) and the task is blocked until Re-run, which continues from there.
export function StopTaskButton({ adoId, itemId }: { adoId: number | null; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onStop() {
    if (!window.confirm(`Stop ${itemId}'s run now? It keeps what it has; Re-run continues from there.`)) {
      return;
    }

    startTransition(async () => {
      const result = await stopTaskAction(adoId, itemId);

      setMessage(result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="danger" onClick={onStop} disabled={isPending} title="Ends the agent now; the run keeps what it has and the task waits for Re-run">{isPending ? "Stopping…" : "Stop"}</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}
