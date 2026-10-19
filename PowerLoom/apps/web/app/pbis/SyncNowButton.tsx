"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { syncNow } from "./actions";

// Syncs the saved sprint again, from the line above the table; the sprint is chosen in the sync section below.
export function SyncNowButton({ sprint }: { sprint: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(syncNow, null);

  return (
    <form action={action} className="sync-now">
      <input type="hidden" name="sprint" value={sprint} />
      <button type="submit" className="secondary small" disabled={isPending}>{isPending ? "Queuing…" : "Sync now"}</button>
      {result && !result.ok && <span className="result-error">{result.message}</span>}
    </form>
  );
}
