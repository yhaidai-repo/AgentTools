"use client";

import { useActionState } from "react";
import type { ImportSettings } from "@adoa/core";
import type { ActionResult } from "@/models/ActionResult";
import { saveImportSettingsAction } from "./actions";

export function ImportSettingsForm({ enabled, importFolder, inboxPath, settings }: { enabled: boolean; importFolder: string | null; inboxPath: string; settings: ImportSettings }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveImportSettingsAction, null);

  return (
    <form action={action} className="card">
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Enabled: import PBIs from the vault&apos;s import folder on the import schedule
      </label>
      <label>
        Import folder inside <code>{inboxPath}</code> (empty = the inbox root)
        <input name="importFolder" defaultValue={importFolder ?? ""} />
      </label>
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
