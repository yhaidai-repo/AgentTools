"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/models/ActionResult";
import { createPbiAction } from "../actions";

const TYPES = ["Product Backlog Item", "Bug", "Task"];
const PRIORITIES = [1, 2, 3, 4];

// Repos (what research and design clone) and attachments can be given at once, as on the PBI page.
export function NewPbiForm({ repos, accept }: { repos: string[]; accept: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(createPbiAction, null);

  return (
    <form action={action} className="card">
      <label>
        Title
        <input name="title" required maxLength={255} />
      </label>
      <label>
        Type
        <select name="type" defaultValue={TYPES[0]}>
          {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label>
        Priority (1 = highest)
        <select name="priority" defaultValue={2}>
          {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
      </label>
      <label>
        Description (Markdown)
        <textarea name="descriptionMd" rows={8} />
      </label>
      <label>
        Acceptance criteria (Markdown)
        <textarea name="acceptanceCriteriaMd" rows={5} />
      </label>
      <fieldset className="repo-choices">
        <legend>Repositories (what research and design clone; the vault&apos;s enabled ones)</legend>
        {repos.length === 0 && <span className="muted">None enabled: configure them in Settings → Repositories.</span>}
        {repos.map((name) => (
          <label key={name} className="inline">
            <input type="checkbox" name="repo" value={name} />
            {name}
          </label>
        ))}
      </fieldset>
      <label>
        Attachments (documents useful for the PBI)
        <FileInput name="files" accept={accept} />
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Creating…" : "Create PBI"}</button>
        <Link className="button secondary" href="/pbis">Cancel</Link>
      </div>
      {result && !result.ok && <p className="result-error">{result.message}</p>}
    </form>
  );
}
