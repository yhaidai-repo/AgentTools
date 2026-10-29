"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { planPbiAction, preparePbiAction } from "../actions";
import { StartButton } from "../StartButton";

// The Backlog's Start, for this PBI (user decision 2026-10-18: "Start", was "Prepare for refinement"): writes the PBI
// note and queues a refinement task, also for one already refined (a re-refinement); its menu queues planning instead.
export function PreparePbiButton({ adoId }: { adoId: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function start(action: (adoId: number) => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action(adoId);

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <>
      <StartButton isPending={isPending} onRefine={() => start(preparePbiAction)} onPlan={() => start(planPbiAction)} secondary align="right" />
      {message && <span className="hero-note">{message}</span>}
    </>
  );
}
