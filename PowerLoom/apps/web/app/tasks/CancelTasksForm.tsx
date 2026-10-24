"use client";

import { useActionState, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { cancelSelected } from "./actions";

// Wraps the server-rendered task table so its row checkboxes submit with this form. Cancel lives in a bar that shows
// only while rows are ticked, like the Backlog's and the Runs page's (user request 2026-10-22).
export function CancelTasksForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(cancelSelected, null);

  function onClear() {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(untick);
    setSelected(0);
  }

  return (
    <form ref={form} action={action} onChange={() => setSelected(selectedCount(form.current))}>
      <div className={`selection-bar${selected > 0 ? " show" : ""}`} aria-hidden={selected === 0}>
        <span key={selected} className="selection-count">{selected} selected</span>
        <button type="submit" className="danger" disabled={isPending} onClick={confirmCancel} title="Cancels the selected tasks that still wait; no agent takes them again">{isPending ? "Cancelling…" : "Cancel tasks"}</button>
        <button type="button" className="link-button selection-clear" onClick={onClear}>Clear</button>
      </div>
      {result && <p className="action-results"><span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span></p>}
      {children}
    </form>
  );
}

function confirmCancel(event: MouseEvent<HTMLButtonElement>): void {
  const count = selectedCount(event.currentTarget.form);

  if (count === 0 || !window.confirm(`Cancel ${count} task(s)? No agent will take them again.`)) {
    event.preventDefault();
  }
}

function selectedCount(form: HTMLFormElement | null): number {
  return form?.querySelectorAll('input[name="taskId"]:checked').length ?? 0;
}

function untick(box: HTMLInputElement): void {
  box.checked = false;
}
