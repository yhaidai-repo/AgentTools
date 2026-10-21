"use client";

import { useActionState } from "react";
import type { CleanupSettings } from "@powerloom/core";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { runCleanupAction, saveCleanupSettingsAction } from "./actions";

interface CleanupSettingsFormProps {
  settings: CleanupSettings;
}

const DAY_FIELDS: { name: keyof CleanupSettings; label: string; hint: string }[] = [
  { name: "closedPbiDays", label: "Closed PBI folders", hint: "backlog notes to the trash after closed/done" },
  { name: "trashDays", label: "Trash", hint: "vault and backlog .trash/" },
  { name: "failedImportDays", label: "Failed imports", hint: "import inbox failed/ files" },
  { name: "runEventDays", label: "Run events", hint: "per-tool trace of successful runs" },
  { name: "browserArtefactDays", label: "Browser recordings", hint: "a run's video and trace (DevHub)" },
  { name: "failedRunBrowserArtefactDays", label: "… of failed runs", hint: "a failed case or a reported bug" },
];

// Artefact cleanup, daily at 03:00 UTC: each store's items past their buffer go; while Dry run is on the job only
// reports (Status page) what would go. 0 days switches a store off.
export function CleanupSettingsForm({ settings }: CleanupSettingsFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveCleanupSettingsAction, null);
  const [runResult, run, isRunning] = useActionState<ActionResult | null, FormData>(runCleanupAction, null);

  return (
    <form action={action} className="panel settings-card">
      <SettingsHead title="Artefact cleanup" description="Daily at 03:00 UTC: closed PBI folders, trash, failed imports, run events and browser recordings past their buffer. Statistics (runs, tokens, cost, reports) stay in the database." />
      <div className="settings-body">
        <div className="field-grid">
          <label className="field"><span>Dry run<small>only report what would go</small></span><input name="dryRun" type="checkbox" defaultChecked={settings.dryRun} /></label>
          {DAY_FIELDS.map((field) => (
            <label key={field.name} className="field"><span>{field.label}<small>{field.hint}; days, 0 = off</small></span><input name={field.name} type="number" min={0} defaultValue={settings[field.name] as number} required /></label>
          ))}
        </div>
      </div>
      <div className="settings-foot">
        <span className="settings-note">The last report is on the dashboard&apos;s Application tab.</span>
        <ResultLine result={runResult ?? result} />
        <button type="submit" formAction={run} disabled={isRunning} className="secondary">{isRunning ? "Starting…" : "Run now"}</button>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
