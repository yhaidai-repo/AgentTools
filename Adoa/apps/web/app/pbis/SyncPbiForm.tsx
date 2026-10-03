"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { syncOnePbi } from "./actions";

// One work item by id or ADO link, from any sprint and in any state: a PBI, or a Task such as a regression bug filed under
// a regression PBI (user decision 2026-10-02). It stays in adoa until the user deletes it.
export function SyncPbiForm() {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(syncOnePbi, null);

  return (
    <form action={action} className="actions">
      <input name="pbi" placeholder="PBI or Task id, or ADO link" aria-label="PBI or Task id, or ADO link" size={26} required />
      <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Queuing…" : "Sync PBI"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}
