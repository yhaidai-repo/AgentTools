"use client";

import { useActionState, type ReactNode } from "react";
import type { ImportSettings } from "@powerloom/core";
import { CronField } from "@/components/CronField";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { saveImportSettingsAction } from "./actions";

interface ImportSettingsFormProps {
  enabled: boolean;
  importFolder: string | null;
  inboxPath: string;
  settings: ImportSettings;
  /** Each source as the import job last saw it, rendered on the server. */
  status: ReactNode;
}

// Mail import: the import job reads every source (Outlook mails from the exporter, JSON requests in the import inbox);
// each PBI is synced and, if new, prepared for refinement.
export function ImportSettingsForm({ enabled, importFolder, inboxPath, settings, status }: ImportSettingsFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveImportSettingsAction, null);

  return (
    <form action={action} className="panel settings-card">
      <SettingsHead title="Mail import" description="Reads every source (Outlook mails from the exporter, JSON requests in the import inbox); a new PBI is prepared for refinement." enabled={enabled} />
      <div className="settings-body">
        {status}
        <div className="field-grid">
          <label className="field"><span>Import folder<small>inside {inboxPath}; empty = its root</small></span><input name="importFolder" defaultValue={importFolder ?? ""} /></label>
          <CronField label="Schedule" value={settings.cron} />
          <label className="field"><span>Max items per run<small>all sources</small></span><input name="maxItemsPerRun" type="number" min={1} defaultValue={settings.maxItemsPerRun} required /></label>
        </div>
      </div>
      <div className="settings-foot">
        <span className="settings-note">Results show on the Backlog under Sync and imports.</span>
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
