"use client";

import { useActionState } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import type { GitHubValues } from "@/models/GitHubValues";
import { saveGitHubAction, syncGitHubAction, testGitHubAction } from "./actions";

// GitHub (user decision 2026-10-25): the owner's repos come into the catalog below (hourly, and on save), agents clone
// them with this token, and its user's pull requests come to Reviews. The token is written, never shown again; an empty
// token field keeps the saved one.
export function GitHubForm({ values }: { values: GitHubValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveGitHubAction, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testGitHubAction, null);
  const [syncResult, syncAction, isSyncing] = useActionState<ActionResult | null, FormData>(syncGitHubAction, null);
  const signedIn = values.login ? ` · signed in as ${values.login}` : "";

  return (
    <KeptForm action={saveAction} actions={{ test: testAction, sync: syncAction }} clearOn={saveResult} className="panel settings-card">
      <SettingsHead title="GitHub" description="The owner's GitHub repos come into this vault's repositories; agents clone the enabled ones with this token, and pull requests you review or wrote come to Reviews." enabled={values.enabled} />
      <div className="settings-body">
        <p className="hint">A fine-grained personal access token with Contents and Pull requests: Read-only on the repos agents should read; Read and write if an agent has GitHub (write) on its Config page (it pushes only its own powerloom/… branches and opens draft pull requests).</p>
        <div className="field-grid">
          <label className="field"><span>Owner<small>a user or organization; empty: every repo the token reads</small></span><input name="owner" defaultValue={values.owner} placeholder="acme" /></label>
          <label className="field"><span>Token<small>{values.hasToken ? `set${signedIn}; type a new one to replace it` : "github_pat_…"}</small></span><input name="token" type="password" autoComplete="off" placeholder={values.hasToken ? "•••••••• unchanged" : ""} /></label>
        </div>
      </div>
      <div className="settings-foot">
        <ResultLine result={saveResult ?? testResult ?? syncResult} />
        {values.enabled && values.hasToken && <button type="submit" data-action="sync" disabled={isSyncing} className="secondary" title="Fetches the owner's repos into the Repositories tab now (otherwise with each sync)">{isSyncing ? "Fetching…" : "Fetch repos now"}</button>}
        <button type="submit" data-action="test" disabled={isTesting} className="secondary">{isTesting ? "Testing…" : "Test GitHub"}</button>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}
