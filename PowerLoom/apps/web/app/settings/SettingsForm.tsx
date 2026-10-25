"use client";

import { useActionState } from "react";
import type { SyncSettings } from "@powerloom/core";
import { CronField } from "@/components/CronField";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import { SprintField } from "@/components/SprintField";
import type { ActionResult } from "@/models/ActionResult";
import type { SprintOption } from "@/models/SprintOption";
import { saveSettings } from "./actions";
import { KeptForm } from "@/components/KeptForm";

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
    <KeptForm action={action} className="panel settings-card">
      <SettingsHead title="PBI sync" description="Pulls the sprint's PBIs on the schedule." enabled={enabled} />
      <div className="settings-body field-grid">
        <div className="field"><span>Sprint</span><SprintField value={sync.sprint} options={sprintOptions} current={currentSprint} /></div>
        <CronField label="Schedule" value={sync.cron} />
        <label className="field"><span>Max PBIs per sync</span><input name="maxItemsPerRun" type="number" min={1} defaultValue={sync.maxItemsPerRun} required /></label>
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}
