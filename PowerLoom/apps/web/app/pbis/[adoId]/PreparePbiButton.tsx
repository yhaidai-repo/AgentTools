"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { preparePbiAction } from "../actions";

// The Backlog's Start, for this PBI (user decision 2026-10-18: "Start", was "Prepare for refinement"): writes the PBI
// note and queues a refinement task, also for one already refined (a re-refinement).
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
    <>
      <button type="button" className="secondary" onClick={onPrepare} disabled={isPending} title="Writes the PBI note from the Vault template and queues a refinement task (also for a PBI already refined)">{isPending ? "Starting…" : "Start"}</button>
      {message && <span className="hero-note">{message}</span>}
    </>
  );
}
