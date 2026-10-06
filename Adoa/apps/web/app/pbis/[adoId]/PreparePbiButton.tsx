"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { preparePbiAction } from "../actions";

// The Backlog's Prepare for refinement, for this PBI (also for one already refined: a re-refinement).
export function PreparePbiButton({ adoId }: { adoId: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPrepare() {
    startTransition(async () => {
      const result = await preparePbiAction(adoId);

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <span className="actions">
      <button type="button" onClick={onPrepare} disabled={isPending}>{isPending ? "Queuing…" : "Prepare for refinement"}</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}
