"use client";

import type { HumanTaskStep } from "@powerloom/core";
import { useActionState, type ReactNode } from "react";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/models/ActionResult";
import { closeItem } from "./actions";
import { KeptForm } from "@/components/KeptForm";

const BUTTONS: Record<string, { decision: string; label: string; secondary?: boolean }[]> = {
  question: [{ decision: "answer", label: "Answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
  human: [{ decision: "done", label: "Done" }, { decision: "cancel", label: "Cancel task", secondary: true }],
  finding: [{ decision: "answer", label: "Close with answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
};

// One open question, human task or finding: a text answer and/or files (items of a PBI only), then the decision button.
// A structured human task gets one card per step with its answer box inside (user decisions 2026-10-05, 2026-10-18), the
// free box becomes a note. The step views come rendered from the server (they read @powerloom/core, which a client
// component can't import).
export function CloseItemForm({ adoId, itemId, kind, accept, steps = [], stepViews = [] }: { adoId: number | null; itemId: string; kind: string; accept: string; steps?: HumanTaskStep[]; stepViews?: ReactNode[] }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(closeItem, null);

  return (
    <KeptForm action={action} clearOn={result} className="close-item">
      <input type="hidden" name="adoId" value={adoId ?? ""} />
      <input type="hidden" name="itemId" value={itemId} />
      {steps.map((step, index) => (
        <div key={index} className="step-card">
          <span className="step-number">{index + 1}</span>
          <div className="step-body">
            {stepViews[index]}
            <textarea name={`answer:${index}`} rows={3} aria-label={`Answer to step ${index + 1}`} placeholder={step.reportBack} />
          </div>
        </div>
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
    </KeptForm>
  );
}

function resolutionPlaceholder(kind: string, hasSteps: boolean): string {
  if (kind !== "human") {
    return "Answer";
  }

  return hasSteps ? "Note (optional)" : "Outcome (optional)";
}
