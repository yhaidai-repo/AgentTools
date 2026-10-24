"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ProviderStatus } from "@/lib/aiProviders";
import type { ActionResult } from "@/models/ActionResult";
import { removeClaudeTokenAction, saveClaudeTokenAction } from "./actions";

// Claude for every agent run (Settings → AI providers): the token is written, never shown again. Without one the
// agent-runner uses CLAUDE_CODE_OAUTH_TOKEN from .env.
export function ClaudeTokenForm({ status }: { status: ProviderStatus | null }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveClaudeTokenAction, null);
  const [removeResult, removeAction, isRemoving] = useActionState<ActionResult | null, FormData>(removeClaudeTokenAction, null);
  const hasSaved = status?.source === "settings";

  return (
    <form className="panel settings-card">
      <SettingsHead title="Claude" description="Agents on Claude models run with this token. Run claude setup-token on this PC and paste the token it prints." />
      <div className="settings-body">
        <p className={status?.connected ? "hint" : "hint text-warn"}>{statusLine(status)}</p>
        <label className="field"><span>Token<small>{hasSaved ? "set; paste a new one to replace it" : "from claude setup-token"}</small></span><input name="token" type="password" autoComplete="off" placeholder={hasSaved ? "•••••••• unchanged" : "sk-ant-oat01-…"} /></label>
      </div>
      <div className="settings-foot">
        <ResultLine result={saveResult ?? removeResult} />
        {hasSaved && <button type="submit" formAction={removeAction} disabled={isRemoving} className="secondary">{isRemoving ? "Removing…" : "Remove token"}</button>}
        <button type="submit" formAction={saveAction} disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function statusLine(status: ProviderStatus | null): string {
  if (!status) {
    return "Unknown: PowerLoom isn't reachable.";
  }

  if (status.source === "settings") {
    return "Connected with the token saved here.";
  }

  return status.source === "env" ? "Connected through CLAUDE_CODE_OAUTH_TOKEN in .env. A token saved here takes its place." : "Not connected: agents on Claude models stop with \"Connect Claude\" until a token is saved.";
}
