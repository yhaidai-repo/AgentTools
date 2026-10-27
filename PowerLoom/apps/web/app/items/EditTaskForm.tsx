"use client";

import { useActionState } from "react";
import { KeptForm } from "@/components/KeptForm";
import type { ActionResult } from "@/models/ActionResult";
import type { TaskText } from "@/models/TaskText";
import { editTaskAction } from "./actions";

// An agent task's own text as fields on its page (user decision 2026-10-26), editable while no run works on it. Saving
// doesn't run it again; Re-run does.
export function EditTaskForm({ adoId, itemId, path, text }: { adoId: number | null; itemId: string; path: string; text: TaskText }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(editTaskAction, null);

  return (
    <KeptForm action={action} className="answer-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="adoId" value={adoId ?? ""} />
      <input type="hidden" name="path" value={path} />
      <label className="field"><span>Title</span><input name="title" defaultValue={text.title} maxLength={120} required /></label>
      <label className="field"><span>Description</span><textarea name="description" rows={rowsOf(text.description)} defaultValue={text.description} maxLength={4000} required /></label>
      <label className="field"><span>Acceptance criteria</span><textarea name="acceptanceCriteria" rows={rowsOf(text.acceptanceCriteria)} defaultValue={text.acceptanceCriteria} maxLength={4000} required /></label>
      <div className="actions">
        <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}

function rowsOf(text: string): number {
  return Math.min(20, Math.max(3, text.split("\n").length + 1));
}
