"use client";

import type { HumanTaskStep } from "@adoa/core";
import { useActionState } from "react";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/models/ActionResult";
import { closeItem } from "./actions";

const BUTTONS: Record<string, { decision: string; label: string; secondary?: boolean }[]> = {
  question: [{ decision: "answer", label: "Answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
  human: [{ decision: "done", label: "Done" }, { decision: "cancel", label: "Cancel task", secondary: true }],
  finding: [{ decision: "answer", label: "Close with answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
};

// One open question, human task or finding: a text answer and/or files (items of a PBI only), then the decision button.
// A structured human task gets one answer box per step (user decision 2026-10-05), the free box becomes a note.
export function CloseItemForm({ adoId, itemId, kind, accept, steps = [] }: { adoId: number | null; itemId: string; kind: string; accept: string; steps?: HumanTaskStep[] }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(closeItem, null);

  return (
    <form action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId ?? ""} />
      <input type="hidden" name="itemId" value={itemId} />
      {steps.map((step, index) => (
        <label key={index}>
          <span>{index + 1}. {step.action} <span className="muted">· {step.reportBack}</span></span>
          <textarea name={`answer:${index}`} rows={4} />
        </label>
      ))}
      <textarea name="resolution" rows={3} placeholder={resolutionPlaceholder(kind, steps.length > 0)} />
      {adoId !== null && <FileInput name="file" accept={accept} />}
      <div className="actions">
        {BUTTONS[kind]?.map((button) => (
          <button key={button.decision} type="submit" name="decision" value={button.decision} disabled={isPending} className={button.secondary ? "secondary" : undefined}>
            {button.label}
          </button>
        ))}
        {isPending && <span className="muted">Saving…</span>}
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </form>
  );
}

function resolutionPlaceholder(kind: string, hasSteps: boolean): string {
  if (kind !== "human") {
    return "Answer";
  }

  return hasSteps ? "Note (optional)" : "Outcome (optional)";
}
