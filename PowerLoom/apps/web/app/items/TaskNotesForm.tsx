"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveTaskNotes } from "./actions";
import { KeptForm } from "@/components/KeptForm";
import { EditorConflictNotice } from "@/components/EditorConflictNotice";
import { useVersionedEditor } from "@/lib/useVersionedEditor";

// `text` is what this page showed: the save is refused when the notes changed since, so nothing unseen is overwritten.
export function TaskNotesForm({ itemId, path, text }: { itemId: string; path: string; text: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(saveTaskNotes, null);
  const editor = useVersionedEditor(`${itemId}:${path}`, text, text);

  return (
    <KeptForm action={action} className="answer-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="loaded" value={editor.baseline} />
      <textarea name="text" rows={Math.min(30, Math.max(6, editor.text.split("\n").length + 2))} value={editor.text} onChange={event => editor.edit(event.target.value)} aria-label="My notes" />
      <EditorConflictNotice conflict={editor.conflict} loadLatest={editor.loadLatest} />
      <div className="actions">
        <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save notes"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}
