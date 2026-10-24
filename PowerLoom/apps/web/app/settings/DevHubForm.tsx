"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import type { DevHubValues } from "@/models/DevHubValues";
import { saveDevHubAction, testDevHubAction } from "./actions";

// DevHub (user decision 2026-10-13): agents start chains of this vault's services on this PC through DevHub
// (DevSecrets). The token is written, never shown again; an empty token field keeps the saved one. Once one is saved, the
// card links to DevHub's own UI (user request 2026-10-14).
export function DevHubForm({ values }: { values: DevHubValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveDevHubAction, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testDevHubAction, null);

  return (
    <form className="panel settings-card">
      <SettingsHead title="DevHub" description="Agents with DevHub switched on may start, inspect and stop this vault's services on this PC. One stack at a time; a run's stack stops when the run ends. Service logs go to the model provider." enabled={values.enabled} />
      <div className="settings-body">
        <p className="hint">Runs on Windows: <code>D:/Projects/AgentTools/DevSecrets/Start-DevHub.ps1</code></p>
        <div className="field-grid">
          <label className="field"><span>DevHub URL<small>as the agent-runner reaches it</small></span><input name="url" defaultValue={values.url} placeholder="http://host.docker.internal:47811" /></label>
          <label className="field"><span>Token<small>the dev-secrets value dev-hub-token{values.hasToken ? " · set; type a new one to replace it" : ""}</small></span><input name="token" type="password" autoComplete="off" placeholder={values.hasToken ? "•••••••• unchanged" : ""} /></label>
        </div>
      </div>
      <div className="settings-foot">
        <ResultLine result={saveResult ?? testResult} />
        {values.hasToken && <a className="button secondary" href={browserUrl(values.url)} target="_blank" rel="noreferrer" title="Sign in there with the same token">Open DevHub ↗</a>}
        <button type="submit" formAction={testAction} disabled={isTesting} className="secondary">{isTesting ? "Testing…" : "Test DevHub"}</button>
        <button type="submit" formAction={saveAction} disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

// The saved URL is the agent-runner's, from inside Docker; DevHub listens on this PC's loopback address only, which is
// where the browser reaches it.
function browserUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "host.docker.internal") {
      parsed.hostname = "127.0.0.1";
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
