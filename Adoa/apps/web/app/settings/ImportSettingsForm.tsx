"use client";

import { useActionState } from "react";
import type { ImportSettings } from "@adoa/core";
import type { ActionResult } from "@/models/ActionResult";
import { saveImportSettingsAction } from "./actions";

export function ImportSettingsForm({ settings }: { settings: ImportSettings }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveImportSettingsAction, null);

  return (
    <form action={action} className="card">
      <label>
        Import schedule (cron)
        <input name="cron" defaultValue={settings.cron} required />
      </label>
      <label>
        Max items imported per run (all sources)
        <input name="maxItemsPerRun" type="number" min={1} defaultValue={settings.maxItemsPerRun} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
