"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import type { AdoIntegrationValues } from "@/models/AdoIntegrationValues";
import { saveAdoIntegration, testConnection } from "./actions";
import { KeptForm } from "@/components/KeptForm";

// The vault's Azure DevOps integration (user decision 2026-10-06): PBI sync, mail sync and pull request sync exist only
// while it is on. The token is written, never shown again; an empty token field keeps the saved one.
export function AdoIntegrationForm({ values }: { values: AdoIntegrationValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveAdoIntegration, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testConnection, null);

  return (
    <KeptForm action={saveAction} actions={{ test: testAction }} clearOn={saveResult} className="panel settings-card">
      <SettingsHead title="Azure DevOps" description="PowerLoom reads this vault's PBIs, mails and pull requests from it." enabled={values.enabled} />
      <div className="settings-body field-grid">
        <label className="field"><span>Organization URL</span><input name="orgUrl" defaultValue={values.orgUrl} placeholder="https://dev.azure.com/org" required /></label>
        <label className="field"><span>Project</span><input name="project" defaultValue={values.project} required /></label>
        <label className="field"><span>Team<small>for sprints</small></span><input name="team" defaultValue={values.team} required /></label>
        <label className="field"><span>Assigned to<small>only their PBIs, and the PRs they review</small></span><input name="user" defaultValue={values.user} placeholder="name@company.com" required /></label>
        <label className="field"><span>Personal access token<small>Work Items Read, Code Read{values.hasPat ? " · set; type a new one to replace it" : ""}</small></span><input name="pat" type="password" autoComplete="off" placeholder={values.hasPat ? "•••••••• unchanged" : ""} required={!values.hasPat} /></label>
      </div>
      <div className="settings-foot">
        <ResultLine result={saveResult ?? testResult} />
        <button type="submit" data-action="test" disabled={isTesting} className="secondary">{isTesting ? "Testing…" : "Test connection"}</button>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}
