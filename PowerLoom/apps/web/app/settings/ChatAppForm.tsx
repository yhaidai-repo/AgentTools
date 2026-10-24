"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ChatApps } from "@/lib/aiProviders";
import { choosableApps } from "@/lib/chatApps";
import type { ActionResult } from "@/models/ActionResult";
import { saveChatAppAction } from "./actions";

// The app "Continue with …" and "Configure with …" open chats in, for every vault.
export function ChatAppForm({ apps }: { apps: ChatApps | null }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveChatAppAction, null);

  return (
    <form action={action} className="panel settings-card">
      <SettingsHead title="Chat app" description="The app on this PC that Continue with … and Configure with … open chats in. Only connected apps can be chosen." />
      <div className="settings-body">
        {apps ? (
          <label className="field"><span>App</span>
            <select name="launcher" defaultValue={apps.current}>
              {choosableApps(apps).map((app) => <option key={app.id} value={app.id}>{app.connected ? app.label : `${app.label} (not connected)`}</option>)}
            </select>
          </label>
        ) : <p className="hint text-warn">Unknown: PowerLoom isn&apos;t reachable.</p>}
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving || !apps}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
