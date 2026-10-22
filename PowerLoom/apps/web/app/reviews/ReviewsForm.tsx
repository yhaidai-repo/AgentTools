"use client";

import { useActionState, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { closeSelected, deleteSelected, queueSelected } from "./actions";

// Wraps the server-rendered table so its row checkboxes submit with this form (user decision 2026-10-06: bulk actions
// like the Backlog). The actions live in a bar that shows only while rows are ticked (user decision 2026-10-18); each
// button explains itself in its tooltip.
export function ReviewsForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [queued, queueAction, isQueuing] = useActionState<ActionResult | null, FormData>(queueSelected, null);
  const [closed, closeAction, isClosing] = useActionState<ActionResult | null, FormData>(closeSelected, null);
  const [deleted, deleteAction, isDeleting] = useActionState<ActionResult | null, FormData>(deleteSelected, null);

  function onClear() {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(untick);
    setSelected(0);
  }

  return (
    <form ref={form} action={queueAction} onChange={() => setSelected(selectedCount(form.current))}>
      <div className={`selection-bar${selected > 0 ? " show" : ""}`} aria-hidden={selected === 0}>
        <span key={selected} className="selection-count">{selected} selected</span>
        <button type="submit" disabled={isQueuing} title="Reviews each PR's current commit; a rerun reopens a closed review">{isQueuing ? "Queuing…" : "Start review"}</button>
        <button type="submit" className="secondary" formAction={closeAction} disabled={isClosing} title="Closes the reviews in PowerLoom only">{isClosing ? "Closing…" : "Close"}</button>
        <button type="submit" className="danger" formAction={deleteAction} disabled={isDeleting} onClick={confirmDelete} title="Removes the reviews from PowerLoom; Azure DevOps is not changed">{isDeleting ? "Deleting…" : "Delete"}</button>
        <button type="button" className="link-button selection-clear" onClick={onClear}>Clear</button>
      </div>
      <ActionResults results={[queued, closed, deleted]} />
      {children}
    </form>
  );
}

// The last answer of each action, kept in view after the bar folds away.
function ActionResults({ results }: { results: (ActionResult | null)[] }) {
  const shown = results.filter((result): result is ActionResult => result !== null);

  if (shown.length === 0) {
    return null;
  }

  return <p className="action-results">{shown.map((result) => <span key={result.message} className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>)}</p>;
}

function confirmDelete(event: MouseEvent<HTMLButtonElement>): void {
  const count = selectedCount(event.currentTarget.form);

  if (count === 0 || !window.confirm(`Delete ${count} review(s) from PowerLoom? Their comments, tasks and runs are removed, and the pull request check won't list the PRs again. Azure DevOps is not changed.`)) {
    event.preventDefault();
  }
}

function selectedCount(form: HTMLFormElement | null): number {
  return form?.querySelectorAll('input[name="prId"]:checked').length ?? 0;
}

function untick(box: HTMLInputElement): void {
  box.checked = false;
}
