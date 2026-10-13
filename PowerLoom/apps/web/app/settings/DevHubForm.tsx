"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { DevHubValues } from "@/models/DevHubValues";
import { saveDevHubAction, testDevHubAction } from "./actions";

// DevHub (user decision 2026-10-13): agents start chains of this vault's services on this PC through DevHub
// (DevSecrets). The token is written, never shown again; an empty token field keeps the saved one. Once one is saved, the
// card links to DevHub's own UI (user request 2026-10-14).
export function DevHubForm({ values }: { values: DevHubValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveDevHubAction, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testDevHubAction, null);
  const result = saveResult ?? testResult;

  return (
    <form className="card">
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={values.enabled} />
        Enabled: agents with DevHub switched on may start, inspect and stop this vault&apos;s services on this PC
      </label>
      <p className="muted">
        DevHub runs on Windows: <code>D:/Projects/AgentTools/DevSecrets/Start-DevHub.ps1</code>. One stack at a time; a run&apos;s stack stops when the run ends. Each agent needs its own DevHub switch on its Config page (<Link href="/agents">Agents</Link>). Service logs go to the model provider.
      </p>
      <label>
        DevHub URL (as the agent-runner reaches it)
        <input name="url" defaultValue={values.url} placeholder="http://host.docker.internal:47811" />
      </label>
      <label>
        Token (the dev-secrets value <code>dev-hub-token</code>){values.hasToken ? ": set; enter a new one to replace it" : ""}
        <input name="token" type="password" autoComplete="off" placeholder={values.hasToken ? "unchanged" : ""} />
      </label>
      <div className="actions">
        <button type="submit" formAction={saveAction} disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
        <button type="submit" formAction={testAction} disabled={isTesting} className="secondary">
          {isTesting ? "Testing…" : "Test DevHub"}
        </button>
        {values.hasToken && (
          <a className="button secondary" href={browserUrl(values.url)} target="_blank" rel="noreferrer" title="Sign in there with the same token">
            Open DevHub
          </a>
        )}
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
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
