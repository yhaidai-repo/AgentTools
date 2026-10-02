"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { syncOnePbi } from "./actions";

// One PBI by id or ADO link, from any sprint; it stays in adoa's scope from then on.
export function SyncPbiForm() {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(syncOnePbi, null);

  return (
    <form action={action} className="actions">
      <input name="pbi" placeholder="PBI id or ADO link" aria-label="PBI id or ADO link" size={22} required />
      <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Queuing…" : "Sync PBI"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}
