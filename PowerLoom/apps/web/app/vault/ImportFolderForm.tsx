"use client";

import { KeptForm } from "@/components/KeptForm";
import { useOpenChat } from "@/components/useOpenChat";
import type { ChatLauncherState } from "@/models/ChatLauncherState";

// "Import with <agent>": a folder of the PC (its path there) goes into the vault through a chat, which proposes the
// structure, moves the files in batches, and ends with a report and what it learned the vault is about.
export function ImportFolderForm({ vault, launcher }: { vault: string; launcher: ChatLauncherState }) {
  const { open, isPending, message } = useOpenChat();

  function onImport(form: FormData) {
    open({ kind: "import", vault, folder: String(form.get("folder") ?? "").trim() });
  }

  return (
    <KeptForm action={onImport} className="import-folder-form">
      <label>
        Import a folder: its path on this PC (read only; the chat writes into {vault} and keeps a report in import-reports/)
        <input name="folder" placeholder="D:/Docs/Old specs" required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isPending || launcher.problem !== null} title={launcher.problem ?? undefined}>{isPending ? "Opening…" : `Import with ${launcher.label}`}</button>
        {launcher.problem && <span className="muted">{launcher.problem}</span>}
        {message && <span className="result-error">{message}</span>}
      </div>
    </KeptForm>
  );
}
