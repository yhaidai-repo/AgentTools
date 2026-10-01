"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { runRefinementNow, setAgentsPaused } from "./actions";

export function AgentControls({ isPaused }: { isPaused: boolean }) {
  const [pauseResult, pauseAction, isPausing] = useActionState<ActionResult | null>(() => setAgentsPaused(!isPaused), null);
  const [runResult, runAction, isQueuing] = useActionState<ActionResult | null>(runRefinementNow, null);
  const result = runResult ?? pauseResult;

  return (
    <div className="toolbar">
      <form action={pauseAction}>
        <button type="submit" className={isPaused ? undefined : "secondary"} disabled={isPausing}>
          {isPaused ? "Resume agents" : "Pause all agents"}
        </button>
      </form>
      <form action={runAction}>
        <button type="submit" className="secondary" disabled={isQueuing || isPaused}>Run refinement now</button>
      </form>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </div>
  );
}
