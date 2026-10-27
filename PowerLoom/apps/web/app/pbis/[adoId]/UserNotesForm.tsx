"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveUserNotes } from "./actions";
import { KeptForm } from "@/components/KeptForm";
import { EditorConflictNotice } from "@/components/EditorConflictNotice";
import { useVersionedEditor } from "@/lib/useVersionedEditor";

// `loaded` is the text this page showed: the save is refused when the vault holds something else since (an Obsidian
// edit), so nothing unseen is overwritten. A saved page reloads, and the new text becomes the loaded one.
export function UserNotesForm({ adoId, text }: { adoId: number; text: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(saveUserNotes, null);
  const editor = useVersionedEditor(String(adoId), text, text);

  return (
    <KeptForm action={action} className="answer-form">
      <input type="hidden" name="adoId" value={adoId} />
      <input type="hidden" name="loaded" value={editor.baseline} />
      <textarea name="text" rows={Math.min(40, Math.max(10, editor.text.split("\n").length + 2))} value={editor.text} onChange={event => editor.edit(event.target.value)} aria-label="My notes" />
      <EditorConflictNotice conflict={editor.conflict} loadLatest={editor.loadLatest} />
      <div className="actions">
        <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save notes"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}
