"use client";

import { useActionState } from "react";
import type { PullRequestSettings } from "@powerloom/core";
import { CronField } from "@/components/CronField";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import { TimeAgo } from "@/components/TimeAgo";
import type { ActionResult } from "@/models/ActionResult";
import type { GitHubCheckValues } from "@/models/GitHubCheckValues";
import { checkGitHubPullRequestsAction, savePullRequestSettingsAction } from "./actions";

// Lists the PRs you review, from Azure DevOps and GitHub alike (user decision 2026-10-26: one feature, one card); the
// repo list is the enabled repos of both as toggle chips (GitHub ones as owner/name), none chosen = every repo (user
// decision 2026-10-02).
export function PullRequestSettingsForm({ enabled, settings, repoNames, gitHubCheck }: { enabled: boolean; settings: PullRequestSettings; repoNames: string[]; gitHubCheck: GitHubCheckValues | null }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(savePullRequestSettingsAction, null);
  const [checkResult, checkAction, isChecking] = useActionState<ActionResult | null, FormData>(checkGitHubPullRequestsAction, null);

  return (
    <KeptForm action={saveAction} actions={{ check: checkAction }} className="panel settings-card">
      <SettingsHead title="Pull requests" description="Lists the active PRs where you're a reviewer or the author, in Azure DevOps and GitHub; each gets a review on the Reviews page." enabled={enabled} />
      <div className="settings-body">
        <div className="field-grid">
          <CronField label="Schedule" value={settings.cron} />
          <label className="field"><span>Max PRs per check</span><input name="maxPullRequestsPerRun" type="number" min={1} defaultValue={settings.maxPullRequestsPerRun} required /></label>
        </div>
        <span className="field-label">Repositories to check<small>none chosen = all</small></span>
        <div className="repo-chips">
          {repoNames.map((name) => (
            <label key={name} className="repo-check">
              <input type="checkbox" name="repos" value={name} defaultChecked={settings.repos.some((repo) => repo.toLowerCase() === name.toLowerCase())} />
              <span>{name}</span>
            </label>
          ))}
        </div>
        {gitHubCheck && <LastGitHubCheck status={gitHubCheck.status} />}
      </div>
      <div className="settings-foot">
        <span className="settings-note">The chips are the repos switched on in Settings → Repositories. The review agent itself is set up on Agents.</span>
        <ResultLine result={saveResult ?? checkResult} />
        {gitHubCheck && <button type="submit" data-action="check" disabled={isChecking} className="secondary">{isChecking ? "Queuing…" : "Check GitHub now"}</button>}
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}

function LastGitHubCheck({ status }: { status: GitHubCheckValues["status"] }) {
  if (!status?.checkedAt) {
    return <p className="hint">GitHub: not checked yet.</p>;
  }

  return <p className={status.error ? "result-error" : "hint"}>Last GitHub check <TimeAgo date={new Date(status.checkedAt)} />: {status.error ?? status.summary}</p>;
}
