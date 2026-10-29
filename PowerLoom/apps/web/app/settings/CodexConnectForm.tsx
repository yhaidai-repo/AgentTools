"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { CodexLoginStart, ProviderStatus } from "@/lib/aiProviders";
import type { ActionResult } from "@/models/ActionResult";
import { cancelCodexLoginAction, codexLoginStatusAction, disconnectCodexAction, saveCodexLoginFileAction, startCodexLoginAction } from "./actions";
import { KeptForm } from "@/components/KeptForm";

// How often the page asks whether the user finished at the link.
const POLL_MS = 3000;

// Codex on the ChatGPT plan (owner's decision 2026-10-24): the agent-runner signs in to PowerLoom's own Codex home with a
// device code, never the user's ~/.codex. The device flow is beta; a login file from a PC where `codex login` worked is
// the fallback.
export function CodexConnectForm({ status }: { status: ProviderStatus | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [started, setStarted] = useState<CodexLoginStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState<ActionResult | null>(null);
  const [fileResult, fileAction, isSaving] = useActionState<ActionResult | null, FormData>(saveCodexLoginFileAction, null);

  useEffect(() => {
    if (!started) {
      return;
    }

    const timer = setInterval(async () => {
      const login = await codexLoginStatusAction();

      if (login.status === "pending") {
        return;
      }

      setStarted(null);
      setError(login.status === "failed" ? login.error ?? "The sign-in failed." : null);
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [started, router]);

  const connect = () => startTransition(async () => {
    const result = await startCodexLoginAction();

    setError(result.ok ? null : result.message);
    setStarted(result.ok ? result.start : null);
  });

  const disconnect = () => startTransition(async () => setDisconnected(await disconnectCodexAction()));

  const cancel = () => startTransition(async () => {
    setStarted(null);
    setDisconnected(await cancelCodexLoginAction());
  });

  return (
    <div className="panel settings-card">
      <SettingsHead title="Codex" badge={<ConnectionBadge connected={status?.connected ?? null} />} description="Agents on Codex models run on your ChatGPT plan, signed in to PowerLoom's own Codex folder (agent-homes/codex), not to your ~/.codex." />
      <div className="settings-body">
        <p className={status?.connected ? "hint" : "hint text-warn"}>{statusLine(status)}</p>
        <p className="hint">Switch on <strong>Device code authorization</strong> in ChatGPT → Settings → Security first: Connect Codex signs in with a code.</p>
        <p className="hint">Codex&apos;s own built-in tools can&apos;t all be switched off: runs use a read-only sandbox and every built-in step shows in the run trace, but agents may see more than PowerLoom&apos;s tools.</p>
        {started && <LoginSteps started={started} />}
        {error && <p className="result-error">{error}</p>}
        <KeptForm action={fileAction} clearOn={fileResult} className="field">
          <span>Or upload a Codex login file<small>auth.json from a PC where codex login worked</small></span>
          <input name="authJson" type="file" accept=".json,application/json" />
          <button type="submit" className="secondary small" disabled={isSaving}>{isSaving ? "Uploading…" : "Upload"}</button>
        </KeptForm>
      </div>
      <div className="settings-foot">
        <ResultLine result={fileResult ?? disconnected} />
        {status?.connected && <button type="button" className="secondary" disabled={isPending} onClick={disconnect}>Disconnect</button>}
        {started && <button type="button" className="secondary" disabled={isPending} onClick={cancel}>Cancel</button>}
        <button type="button" disabled={isPending || started !== null} onClick={connect}>{isPending ? "Starting…" : "Connect Codex"}</button>
      </div>
    </div>
  );
}

// The link and the code; the CLI's own text when either couldn't be read from it (the device flow is beta).
function LoginSteps({ started }: { started: CodexLoginStart }) {
  if (!started.verificationUri || !started.userCode) {
    return <pre className="hint">{started.output}</pre>;
  }

  return (
    <p>
      Open <a href={started.verificationUri} target="_blank" rel="noreferrer">{started.verificationUri}</a> and enter the code <strong><code>{started.userCode}</code></strong>, then sign in with your ChatGPT account. This page updates by itself when you&apos;re done.
    </p>
  );
}

function statusLine(status: ProviderStatus | null): string {
  if (!status) {
    return "Unknown: PowerLoom isn't reachable.";
  }

  return status.connected ? "Connected: agents on Codex models can run." : "Not connected: agents on Codex models stop with \"Connect Codex\" until you connect.";
}
