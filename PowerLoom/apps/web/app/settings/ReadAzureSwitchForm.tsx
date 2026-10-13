"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { saveReadAzureKindAction } from "./actions";

// One kind's switch (user decision 2026-10-13: a feature per kind).
export function ReadAzureSwitchForm({ kind, label, enabled }: { kind: AzureResourceKind; label: string; enabled: boolean }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveReadAzureKindAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        {label}
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
