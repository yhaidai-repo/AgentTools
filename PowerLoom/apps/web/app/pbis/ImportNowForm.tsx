"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { importNow } from "./actions";

// Reads the import sources now instead of on their schedule.
export function ImportNowForm() {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(importNow, null);

  return (
    <form action={action} className="actions">
      <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Queuing…" : "Import now"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}
