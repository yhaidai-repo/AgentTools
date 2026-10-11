"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { FindingData } from "@powerloom/core";
import { submitFindingAction } from "./actions";

interface FindingFormProps {
  adoId: number | null;
  itemId: string;
  title: string;
  text: string;
  data: FindingData;
}

// The tech-writer's draft of a register record, editable before it goes into the project's open questions or known issues.
export function FindingForm({ adoId, itemId, title, text, data }: FindingFormProps) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(submitFindingAction, null);

  return (
    <form action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId ?? ""} />
      <input type="hidden" name="itemId" value={itemId} />
      <label>
        Register
        <select name="type" defaultValue={data.type}>
          <option value="question">Open questions (OQ)</option>
          <option value="issue">Known issues (KI)</option>
        </select>
      </label>
      <label>
        Project (vault folder)
        <input name="project" defaultValue={data.project} />
      </label>
      <label>
        Title
        <input name="title" defaultValue={title} />
      </label>
      <label>
        Text
        <textarea name="text" rows={4} defaultValue={text} />
      </label>
      <label>
        Default (one line each, optional)
        <textarea name="default" rows={2} defaultValue={(data.default ?? []).join("\n")} />
      </label>
      <label>
        Options (one line each, optional)
        <textarea name="options" rows={3} defaultValue={(data.options ?? []).join("\n")} />
      </label>
      <div className="actions">
        <button type="submit" disabled={isPending}>Submit to vault</button>
        {isPending && <span className="muted">Submitting…</span>}
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </form>
  );
}
