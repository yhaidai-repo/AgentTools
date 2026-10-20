"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { runAgentNow, setAgentsPaused } from "./actions";
import { useRunNowReport } from "./RunNowResults";

// Pauses or resumes every agent from the page head (user decision 2026-10-18): a switch that shows the state.
export function PauseSwitch({ isPaused }: { isPaused: boolean }) {
  const [result, action, isPending] = useActionState<ActionResult | null>(() => setAgentsPaused(!isPaused), null);

  return (
    <form action={action} className="pause-switch-form">
      <button type="submit" className={`pause-switch${isPaused ? " paused" : ""}`} disabled={isPending} title={isPaused ? "Resumes every agent" : "Pauses every agent: nothing new starts, running runs finish"}>
        {isPaused ? "Agents paused" : "Agents running"}
        <span className="pause-knob" aria-hidden="true" />
      </button>
      {result && !result.ok && <span className="result-error">{result.message}</span>}
    </form>
  );
}

export function ResumeButton() {
  const [result, action, isPending] = useActionState<ActionResult | null>(() => setAgentsPaused(false), null);

  return (
    <form action={action} className="actions">
      <button type="submit" disabled={isPending}>{isPending ? "Resuming…" : "Resume"}</button>
      {result && !result.ok && <span className="result-error">{result.message}</span>}
    </form>
  );
}

export function RunNowButton({ agentId, disabled }: { agentId: string; disabled: boolean }) {
  const report = useRunNowReport();
  const [result, action, isPending] = useActionState<ActionResult | null>(async () => {
    const answer = await runAgentNow(agentId);

    report?.(answer);

    return answer;
  }, null);

  return (
    <form action={action} className="actions">
      <button type="submit" className="secondary small" disabled={disabled || isPending}>Run now</button>
      {!report && <ResultLine result={result} />}
    </form>
  );
}
