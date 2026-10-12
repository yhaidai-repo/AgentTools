"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveReadSqlAction } from "./actions";

export function ReadSqlSwitchForm({ enabled }: { enabled: boolean }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveReadSqlAction, null);

  return (
    <form action={action}>
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Enabled: agents with Read SQL switched on may query this vault&apos;s enabled connections
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
