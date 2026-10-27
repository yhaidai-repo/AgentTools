"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeptForm } from "@/components/KeptForm";
import type { ActionResult } from "@/models/ActionResult";
import type { TaskText } from "@/models/TaskText";
import { editTaskAction } from "./actions";

/** The header's Edit button links here; the section opens and scrolls into view. */
export const EDIT_TASK_ANCHOR = "edit-task";

// An agent task's own text (user decision 2026-10-26): what the New task form takes, editable while the task isn't
// running. Saving doesn't run it again; Re-run does.
export function EditTaskForm({ adoId, itemId, path, text }: { adoId: number | null; itemId: string; path: string; text: TaskText }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(editTaskAction, null);
  const section = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openOnAnchor = () => {
      if (window.location.hash === `#${EDIT_TASK_ANCHOR}` && section.current) {
        section.current.open = true;
        section.current.scrollIntoView({ block: "start" });
      }
    };

    openOnAnchor();
    window.addEventListener("hashchange", openOnAnchor);

    return () => window.removeEventListener("hashchange", openOnAnchor);
  }, []);

  return (
    <details className="edit-task" id={EDIT_TASK_ANCHOR} ref={section}>
      <summary>Edit task</summary>
      <KeptForm action={action} className="answer-form">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="adoId" value={adoId ?? ""} />
        <input type="hidden" name="path" value={path} />
        <label className="field"><span>Title</span><input name="title" defaultValue={text.title} maxLength={120} required /></label>
        <label className="field"><span>Description</span><textarea name="description" rows={6} defaultValue={text.description} maxLength={4000} required /></label>
        <label className="field"><span>Acceptance criteria</span><textarea name="acceptanceCriteria" rows={4} defaultValue={text.acceptanceCriteria} maxLength={4000} required /></label>
        <div className="actions">
          <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
          {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
        </div>
      </KeptForm>
    </details>
  );
}
