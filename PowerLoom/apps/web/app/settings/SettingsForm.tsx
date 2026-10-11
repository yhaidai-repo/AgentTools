"use client";

import { useActionState } from "react";
import type { SyncSettings } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { SprintField } from "@/components/SprintField";
import type { SprintOption } from "@/models/SprintOption";
import { saveSettings } from "./actions";

interface SettingsFormProps {
  enabled: boolean;
  sync: SyncSettings;
  sprintOptions: SprintOption[] | null;
  currentSprint: string | null;
}

// PBI sync: which sprint the vault pulls, how often (its ADO integration says from where).
export function SettingsForm({ enabled, sync, sprintOptions, currentSprint }: SettingsFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveSettings, null);

  return (
    <form action={action} className="card">
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Enabled: pull the sprint&apos;s PBIs on the sync schedule
      </label>
      <label>
        Sprint to sync
        <SprintField value={sync.sprint} options={sprintOptions} current={currentSprint} />
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
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
