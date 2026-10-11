"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { runAgentNow, setAgentsPaused } from "./actions";

export function PauseControl({ isPaused }: { isPaused: boolean }) {
  const [result, action, isPending] = useActionState<ActionResult | null>(() => setAgentsPaused(!isPaused), null);

  return (
    <form action={action} className="toolbar">
      <button type="submit" className={isPaused ? undefined : "secondary"} disabled={isPending}>
        {isPaused ? "Resume agents" : "Pause all agents"}
      </button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}

export function RunNowButton({ agentId, disabled }: { agentId: string; disabled: boolean }) {
  const [result, action, isPending] = useActionState<ActionResult | null>(() => runAgentNow(agentId), null);

  return (
    <form action={action}>
      <button type="submit" className="secondary" disabled={disabled || isPending}>Run now</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}> {result.message}</span>}
    </form>
  );
}
