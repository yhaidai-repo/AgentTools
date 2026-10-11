"use client";

import { useActionState, type MouseEvent, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { closeSelected, deleteSelected, queueSelected } from "./actions";

// Wraps the server-rendered grid so its row checkboxes submit with this form (user decision 2026-10-06: bulk actions like
// the Backlog): Start / rerun, Close and Delete for the selected reviews.
export function ReviewsForm({ children }: { children: ReactNode }) {
  const [queued, queueAction, isQueuing] = useActionState<ActionResult | null, FormData>(queueSelected, null);
  const [closed, closeAction, isClosing] = useActionState<ActionResult | null, FormData>(closeSelected, null);
  const [deleted, deleteAction, isDeleting] = useActionState<ActionResult | null, FormData>(deleteSelected, null);
  const result = deleted ?? closed ?? queued;

  return (
    <form action={queueAction}>
      <div className="toolbar">
        <button type="submit" disabled={isQueuing}>{isQueuing ? "Queuing…" : "Start review"}</button>
        <button type="submit" className="secondary" formAction={closeAction} disabled={isClosing}>{isClosing ? "Closing…" : "Close"}</button>
        <button type="submit" className="secondary" formAction={deleteAction} disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? "Deleting…" : "Delete"}</button>
        <span className="muted">Start reviews the PR&apos;s current commit (a rerun reopens a closed review). Close is local only. Delete removes the review from PowerLoom.</span>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
      {children}
    </form>
  );
}

function confirmDelete(event: MouseEvent<HTMLButtonElement>): void {
  const count = event.currentTarget.form?.querySelectorAll('input[name="prId"]:checked').length ?? 0;

  if (count === 0 || !window.confirm(`Delete ${count} review(s) from PowerLoom? Their comments, tasks and runs are removed, and the pull request check won't list the PRs again. Azure DevOps is not changed.`)) {
    event.preventDefault();
  }
}
