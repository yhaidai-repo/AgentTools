"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { closeItem } from "./actions";

const BUTTONS: Record<string, { decision: string; label: string; secondary?: boolean }[]> = {
  question: [{ decision: "answer", label: "Answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
  human: [{ decision: "done", label: "Done" }, { decision: "cancel", label: "Cancel task", secondary: true }],
  finding: [{ decision: "answer", label: "Close with answer" }, { decision: "dismiss", label: "Dismiss", secondary: true }],
};

// One open question, human task or finding: a text answer and/or a file (items of a PBI only), then the decision button.
export function CloseItemForm({ adoId, itemId, kind, accept }: { adoId: number | null; itemId: string; kind: string; accept: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(closeItem, null);

  return (
    <form action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId ?? ""} />
      <input type="hidden" name="itemId" value={itemId} />
      <textarea name="resolution" rows={3} placeholder={kind === "human" ? "Outcome (optional)" : "Answer"} />
      {adoId !== null && <input type="file" name="file" accept={accept} />}
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
