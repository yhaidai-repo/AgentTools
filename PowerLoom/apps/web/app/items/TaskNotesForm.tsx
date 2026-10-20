"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveTaskNotes } from "./actions";

// `text` is what this page showed: the save is refused when the notes changed since, so nothing unseen is overwritten.
export function TaskNotesForm({ itemId, path, text }: { itemId: string; path: string; text: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(saveTaskNotes, null);

  return (
    <form action={action} className="answer-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="loaded" value={text} />
      <textarea name="text" rows={Math.min(30, Math.max(6, text.split("\n").length + 2))} defaultValue={text} aria-label="My notes" />
      <div className="actions">
        <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save notes"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </form>
  );
}
