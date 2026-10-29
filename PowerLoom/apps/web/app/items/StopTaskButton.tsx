"use client";

import { useState, useTransition } from "react";
import { confirmDialog } from "@/lib/confirmDialog";
import { stopTaskAction } from "./actions";

// Stops a task's run in progress (user decision 2026-10-26): the agent ends at once, the run keeps its result (or its
// last words as a partial one) and the task is blocked until Re-run, which continues from there.
export function StopTaskButton({ adoId, itemId }: { adoId: number | null; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onStop() {
    const isConfirmed = await confirmDialog({ title: `Stop the run of ${itemId}?`, message: "It keeps what it has; Re-run continues from there.", confirmLabel: "Stop run", isDanger: true });

    if (!isConfirmed) {
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
