"use client";

import { useActionState } from "react";
import type { PullRequestSettings } from "@powerloom/core";
import { CronField } from "@/components/CronField";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { savePullRequestSettingsAction } from "./actions";

// Lists the PRs you review; the repo list is the catalog (not excluded) as toggle chips, none chosen = every repo (user
// decision 2026-10-02).
export function PullRequestSettingsForm({ enabled, settings, repoNames }: { enabled: boolean; settings: PullRequestSettings; repoNames: string[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(savePullRequestSettingsAction, null);

  return (
    <form action={action} className="panel settings-card">
      <SettingsHead title="Pull requests" description="Lists the active PRs where you're a reviewer or the author; each gets a review on the Reviews page." enabled={enabled} />
      <div className="settings-body">
        <div className="field-grid">
          <CronField label="Schedule" value={settings.cron} />
          <label className="field"><span>Max PRs per check</span><input name="maxPullRequestsPerRun" type="number" min={1} defaultValue={settings.maxPullRequestsPerRun} required /></label>
        </div>
        <span className="field-label">Repositories to check<small>none chosen = all</small></span>
        <div className="repo-chips">
          {repoNames.map((name) => (
            <label key={name} className="repo-check">
              <input type="checkbox" name="repos" value={name} defaultChecked={settings.repos.includes(name)} />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="settings-foot">
        <span className="settings-note">The review agent itself is set up on Agents.</span>
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
