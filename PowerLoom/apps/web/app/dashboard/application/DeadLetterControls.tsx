"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { discardDeadLetter, replayDeadLetter } from "./deadLetterActions";

export function DeadLetterControls({ id, replayable }: { id: string; replayable: boolean }) {
  const [replay, replayAction, replaying] = useActionState<ActionResult | null>(() => replayDeadLetter(id), null);
  const [discard, discardAction, discarding] = useActionState<ActionResult | null>(() => discardDeadLetter(id), null);
  const result = replay ?? discard;

  return (
    <span className="toolbar">
      <form action={replayAction}>
        <button type="submit" className="secondary" disabled={replayable || replaying || discarding}>Replay</button>
      </form>
      <form action={discardAction}>
        <button type="submit" className="secondary" disabled={replaying || discarding}>Discard</button>
      </form>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </span>
  );
}
