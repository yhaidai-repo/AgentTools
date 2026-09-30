"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { syncNow } from "./actions";

export function SyncNowButton() {
  const [result, action, isPending] = useActionState<ActionResult | null>(syncNow, null);

  return (
    <form action={action} className="actions">
      <button type="submit" disabled={isPending}>{isPending ? "Queuing…" : "Sync now"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}
