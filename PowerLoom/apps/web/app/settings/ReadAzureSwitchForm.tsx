"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveReadAzureAction } from "./actions";

export function ReadAzureSwitchForm({ enabled }: { enabled: boolean }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveReadAzureAction, null);

  return (
    <form action={action}>
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Enabled: agents with a kind&apos;s switch on may read this vault&apos;s enabled resources of that kind
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
