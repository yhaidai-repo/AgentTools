"use client";

import { useActionState, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { confirmedClick } from "@/lib/confirmSubmit";
import type { ActionResult } from "@/models/ActionResult";
import { actOnSelected } from "./actions";

// Wraps the server-rendered task table so its row checkboxes submit with this form. The actions live in a bar that
// shows only while rows are ticked, like the Backlog's and the Runs page's (user requests 2026-10-22, 2026-10-25).
export function TaskSelectionForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(actOnSelected, null);

  function onClear() {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(untick);
    setSelected(0);
  }

  return (
    <form ref={form} action={action} onChange={() => setSelected(selectedCount(form.current))}>
      <div className={`selection-bar${selected > 0 ? " show" : ""}`} aria-hidden={selected === 0}>
        <span key={selected} className="selection-count">{selected} selected</span>
        <button type="submit" name="action" value="rerun" className="secondary" disabled={isPending} title="Reopens the selected finished or failed agent tasks; a run continues the last run's conversation if it didn't finish">Re-run</button>
        <button type="submit" name="action" value="start-over" className="secondary" disabled={isPending} title="Reopens the selected finished or failed agent tasks to run again from the start, without the last run's conversation or result">Start over</button>
        <button type="submit" name="action" value="cancel" className="danger" disabled={isPending} onClick={confirmCancel} title="Cancels the selected tasks that still wait; no agent takes them again">Cancel tasks</button>
        <button type="button" className="link-button selection-clear" onClick={onClear}>Clear</button>
        {isPending && <span className="muted">Working…</span>}
      </div>
      {result && <p className="action-results"><span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span></p>}
      {children}
    </form>
  );
}

function confirmCancel(event: MouseEvent<HTMLButtonElement>): void {
  const count = selectedCount(event.currentTarget.form);

  if (count === 0) {
    event.preventDefault();

    return;
  }

  confirmedClick(event, { title: `Cancel ${count} task(s)?`, message: "No agent will take them again.", confirmLabel: "Cancel tasks", isDanger: true });
}

function selectedCount(form: HTMLFormElement | null): number {
  return form?.querySelectorAll('input[name="taskId"]:checked').length ?? 0;
}

function untick(box: HTMLInputElement): void {
  box.checked = false;
}
