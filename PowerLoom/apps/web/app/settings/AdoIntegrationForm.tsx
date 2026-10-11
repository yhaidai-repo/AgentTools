"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { AdoIntegrationValues } from "@/models/AdoIntegrationValues";
import { saveAdoIntegration, testConnection } from "./actions";

// The vault's Azure DevOps integration (user decision 2026-10-06): PBI sync, mail sync and pull request sync exist only
// while it is on. The token is written, never shown again; an empty token field keeps the saved one.
export function AdoIntegrationForm({ values }: { values: AdoIntegrationValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveAdoIntegration, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testConnection, null);
  const result = saveResult ?? testResult;

  return (
    <form className="card">
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={values.enabled} />
        Enabled: PowerLoom reads this vault&apos;s PBIs, mails and pull requests from Azure DevOps
      </label>
      <label>
        Organization URL
        <input name="orgUrl" defaultValue={values.orgUrl} placeholder="https://dev.azure.com/org" required />
      </label>
      <label>
        Project
        <input name="project" defaultValue={values.project} required />
      </label>
      <label>
        Team (for sprints)
        <input name="team" defaultValue={values.team} required />
      </label>
      <label>
        Assigned to (only this user&apos;s PBIs are pulled, and the PRs this user reviews)
        <input name="user" defaultValue={values.user} placeholder="name@company.com" required />
      </label>
      <label>
        Personal access token (Work Items Read, Code Read){values.hasPat ? ": set; enter a new one to replace it" : ""}
        <input name="pat" type="password" autoComplete="off" placeholder={values.hasPat ? "unchanged" : ""} required={!values.hasPat} />
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
