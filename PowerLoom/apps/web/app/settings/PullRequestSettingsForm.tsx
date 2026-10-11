"use client";

import { useActionState } from "react";
import type { PullRequestSettings } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { savePullRequestSettingsAction } from "./actions";

// The repo list is the catalog (not excluded); none checked = every repo (user decision 2026-10-02).
export function PullRequestSettingsForm({ enabled, settings, repoNames }: { enabled: boolean; settings: PullRequestSettings; repoNames: string[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(savePullRequestSettingsAction, null);

  return (
    <form action={action} className="card">
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Enabled: list the PRs you review on the pull request schedule
      </label>
      <label>
        Pull request check schedule (cron)
        <input name="cron" defaultValue={settings.cron} required />
      </label>
      <label>
        Max PRs updated per check
        <input name="maxPullRequestsPerRun" type="number" min={1} defaultValue={settings.maxPullRequestsPerRun} required />
      </label>
      <fieldset className="repo-choices">
        <legend>Repositories to check (none checked = all)</legend>
        {repoNames.map((name) => (
          <label key={name} className="inline">
            <input type="checkbox" name="repos" value={name} defaultChecked={settings.repos.includes(name)} />
            {name}
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
