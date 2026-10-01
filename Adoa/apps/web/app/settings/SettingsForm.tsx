"use client";

import { useActionState } from "react";
import type { AdoSettings, SyncSettings } from "@adoa/core";
import type { ActionResult } from "@/models/ActionResult";
import { SprintField } from "@/components/SprintField";
import type { SprintOption } from "@/models/SprintOption";
import { saveSettings, testConnection } from "./actions";

interface SettingsFormProps {
  ado: AdoSettings;
  sync: SyncSettings;
  sprintOptions: SprintOption[] | null;
  currentSprint: string | null;
}

export function SettingsForm({ ado, sync, sprintOptions, currentSprint }: SettingsFormProps) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveSettings, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testConnection, null);
  const result = saveResult ?? testResult;

  return (
    <form className="card">
      <label>
        Organization URL
        <input name="orgUrl" defaultValue={ado.orgUrl} placeholder="https://dev.azure.com/org" required />
      </label>
      <label>
        Project
        <input name="project" defaultValue={ado.project} required />
      </label>
      <label>
        Team (for sprints)
        <input name="team" defaultValue={ado.team} required />
      </label>
      <label>
        Sprint to sync
        <SprintField value={sync.sprint} options={sprintOptions} current={currentSprint} />
      </label>
      <label>
        ADO states to pull (comma-separated, empty = all)
        <input name="states" defaultValue={sync.states.join(", ")} placeholder="New, Ready for Dev" />
      </label>
      <label>
        Assigned to (only this user's PBIs are pulled)
        <input name="user" defaultValue={ado.user} placeholder="name@company.com" required />
      </label>
      <label>
        Sync schedule (cron)
        <input name="cron" defaultValue={sync.cron} required />
      </label>
      <label>
        Max PBIs fetched per sync
        <input name="maxItemsPerRun" type="number" min={1} defaultValue={sync.maxItemsPerRun} required />
      </label>
      <div className="actions">
        <button type="submit" formAction={saveAction} disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
        <button type="submit" formAction={testAction} disabled={isTesting} className="secondary">
          {isTesting ? "Testing…" : "Test connection"}
        </button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
