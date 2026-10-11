"use client";

import { useActionState, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { FinishDialog } from "@/components/FinishDialog";
import type { ActionResult } from "@/models/ActionResult";
import type { PbiToFinish } from "@/models/PbiToFinish";
import { deleteSelected, prepareSelected } from "./actions";

// Wraps the server-rendered table so its row checkboxes submit with this form: Prepare the selected PBIs, or Finish them
// through the Finish dialog, one PBI at a time.
export function BacklogForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [prepared, prepareAction, isPreparing] = useActionState<ActionResult | null, FormData>(prepareSelected, null);
  const [deleted, deleteAction, isDeleting] = useActionState<ActionResult | null, FormData>(deleteSelected, null);
  const [toFinish, setToFinish] = useState<PbiToFinish[] | null>(null);
  const [finished, setFinished] = useState<string | null>(null);

  function onFinish() {
    const selected = selectedPbis(form.current);

    setFinished(selected.length === 0 ? "Select at least one PBI." : null);
    setToFinish(selected.length > 0 ? selected : null);
  }

  function onFinishDone(messages: string[]) {
    setToFinish(null);
    setFinished(messages.join(" ") || null);
  }

  // The dialog has its own form, so it stays outside this one (forms can't nest).
  return (
    <>
      <form ref={form} action={prepareAction}>
        <div className="toolbar">
          <button type="submit" disabled={isPreparing}>{isPreparing ? "Queuing…" : "Prepare for refinement"}</button>
          <button type="button" className="secondary" onClick={onFinish}>Finish</button>
          <button type="submit" className="secondary" formAction={deleteAction} disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? "Deleting…" : "Delete"}</button>
          <span className="muted">Prepare writes the PBI note from the Vault template and queues a refinement task (also for a PBI already refined). Finish marks the PBIs done in PowerLoom. Delete removes them from PowerLoom only.</span>
          {prepared && <span className={prepared.ok ? "result-ok" : "result-error"}>{prepared.message}</span>}
          {deleted && <span className={deleted.ok ? "result-ok" : "result-error"}>{deleted.message}</span>}
          {finished && <span className="muted">{finished}</span>}
        </div>
        {children}
      </form>
      {toFinish && <FinishDialog pbis={toFinish} onDone={onFinishDone} />}
    </>
  );
}

// Asks first: the selected PBIs and everything PowerLoom made for them go; sync won't bring them back (ADO stays untouched).
function confirmDelete(event: React.MouseEvent<HTMLButtonElement>): void {
  const count = selectedPbis(event.currentTarget.form).length;

  if (count === 0 || !window.confirm(`Delete ${count} PBI(s) from PowerLoom? Their child items, tasks, questions, runs, attachments, repos and notes are removed; Azure DevOps is not changed.`)) {
    event.preventDefault();
  }
}

// The ticked rows; each checkbox carries its PBI's title for the dialog.
function selectedPbis(form: HTMLFormElement | null): PbiToFinish[] {
  const checked = form ? [...form.querySelectorAll<HTMLInputElement>('input[name="adoId"]:checked')] : [];

  return checked.map((input) => ({ adoId: Number(input.value), title: input.dataset.title ?? "" }));
}
