"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { rerunSelected } from "./actions";

// Wraps the server-rendered run table so its row checkboxes submit with this form (like the Backlog's Prepare).
export function RerunForm({ children }: { children: ReactNode }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(rerunSelected, null);

  return (
    <form action={action}>
      <div className="toolbar">
        <button type="submit" disabled={isPending}>{isPending ? "Reopening…" : "Re-run selected"}</button>
        <span className="muted">Reopens the selected runs&apos; tasks (finished or blocked ones; an open task runs again by itself).</span>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
      {children}
    </form>
  );
}
