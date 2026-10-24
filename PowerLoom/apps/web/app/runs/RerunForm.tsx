"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { rerunSelected } from "./actions";

// Wraps the server-rendered run table so its row checkboxes submit with this form. Re-run lives in a bar that shows only
// while rows are ticked (user decision 2026-10-18), like the Backlog's.
export function RerunForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(rerunSelected, null);

  function onClear() {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(untick);
    setSelected(0);
  }

  return (
    <form ref={form} action={action} onChange={() => setSelected(selectedCount(form.current))}>
      <div className={`selection-bar${selected > 0 ? " show" : ""}`} aria-hidden={selected === 0}>
        <span key={selected} className="selection-count">{selected} selected</span>
        <button type="submit" disabled={isPending} title="Reopens the selected runs' tasks (finished or blocked ones; an open task runs again by itself)">{isPending ? "Reopening…" : "Re-run"}</button>
        <button type="button" className="link-button selection-clear" onClick={onClear}>Clear</button>
      </div>
      {result && <p className="action-results"><span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span></p>}
      {children}
    </form>
  );
}

function selectedCount(form: HTMLFormElement | null): number {
  return form?.querySelectorAll('input[name="taskId"]:checked').length ?? 0;
}

function untick(box: HTMLInputElement): void {
  box.checked = false;
}
