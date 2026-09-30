"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { prepareSelected } from "./actions";

// Wraps the server-rendered table so its row checkboxes submit with this form.
export function PrepareForm({ children }: { children: ReactNode }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(prepareSelected, null);

  return (
    <form action={action}>
      <div className="toolbar">
        <button type="submit" disabled={isPending}>{isPending ? "Queuing…" : "Prepare for refinement"}</button>
        <span className="muted">Creates the PBI note from the Vault template for the selected rows.</span>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
      {children}
    </form>
  );
}
