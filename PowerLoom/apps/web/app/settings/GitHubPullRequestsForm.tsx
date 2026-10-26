"use client";

import { useActionState } from "react";
import { CronField } from "@/components/CronField";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import { TimeAgo } from "@/components/TimeAgo";
import type { ActionResult } from "@/models/ActionResult";
import type { GitHubPullRequestsValues } from "@/models/GitHubPullRequestsValues";
import { checkGitHubPullRequestsAction, saveGitHubPullRequestsAction } from "./actions";

// GitHub's pull request check (user decision 2026-10-25), like Azure DevOps': on once GitHub is connected, it lists the
// open PRs of the chosen GitHub repos (none chosen = every enabled one) that you wrote, are asked to review or
// reviewed; each gets a review on Reviews.
export function GitHubPullRequestsForm({ values }: { values: GitHubPullRequestsValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveGitHubPullRequestsAction, null);
  const [checkResult, checkAction, isChecking] = useActionState<ActionResult | null, FormData>(checkGitHubPullRequestsAction, null);

  return (
    <KeptForm action={saveAction} actions={{ check: checkAction }} className="panel settings-card">
      <SettingsHead title="GitHub pull requests" description={`Lists the open PRs of the chosen GitHub repos that ${values.login || "you"} wrote, is asked to review or reviewed; each gets a review on the Reviews page.`} enabled={values.enabled} />
      <div className="settings-body">
        <div className="field-grid">
          <CronField label="Schedule" value={values.cron} />
        </div>
        <span className="field-label">Repositories to check<small>none chosen = all</small></span>
        <div className="repo-chips">
          {values.repoNames.map((name) => (
            <label key={name} className="repo-check">
              <input type="checkbox" name="repos" value={name} defaultChecked={values.repos.some((repo) => repo.toLowerCase() === name.toLowerCase())} />
              <span>{name}</span>
            </label>
          ))}
        </div>
        {values.repoNames.length === 0 && <p className="hint">No GitHub repos are enabled yet: sync them on the GitHub tab, then switch them on in Settings → Repositories.</p>}
        <LastCheck status={values.status} />
      </div>
      <div className="settings-foot">
        <span className="settings-note">The chips are the GitHub repos switched on in Settings → Repositories. The review agent itself is set up on Agents.</span>
        <ResultLine result={saveResult ?? checkResult} />
        <button type="submit" data-action="check" disabled={isChecking} className="secondary">{isChecking ? "Queuing…" : "Check now"}</button>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}

function LastCheck({ status }: { status: GitHubPullRequestsValues["status"] }) {
  if (!status?.checkedAt) {
    return <p className="hint">Not checked yet.</p>;
  }

  return <p className={status.error ? "result-error" : "hint"}>Last check <TimeAgo date={new Date(status.checkedAt)} />: {status.error ?? status.summary}</p>;
}
