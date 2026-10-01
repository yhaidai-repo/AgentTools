"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { restoreRevision } from "./actions";

export function RestoreButton({ name, revisionId, hash }: { name: string; revisionId: number; hash: string }) {
  const [result, action, isRestoring] = useActionState<ActionResult | null, FormData>(restoreRevision, null);

  return (
    <form action={action} className="actions">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="hash" value={hash} />
      <button type="submit" className="secondary" disabled={isRestoring}>{isRestoring ? "Restoring…" : "Restore"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}
