"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TaskActionResult } from "@/models/TaskActionResult";
import type { TaskFormValues } from "@/models/TaskFormValues";
import { RepoChoices } from "../RepoChoices";
import { saveTaskAction } from "./actions";

const PBI_HINTS: Record<string, string> = {
  refinement: "required",
  design: "required",
  research: "optional; without one, the agent reads the repositories below",
};

// A task for any agent that takes its type (user decision 2026-10-14): what to do, when it is done, and what it works
// on. Refinement and design need a PBI; research may have one; docs names no note, the tech-writer finds the notes
// (user decision 2026-10-15). With a cron the form saves a schedule that creates this task on each tick instead. A
// refused save shows what was typed again: React resets a form after its action, to the defaults rendered then.
export function TaskForm({ values, types, repos }: { values: TaskFormValues; types: string[]; repos: string[] }) {
  const [result, action, isSaving] = useActionState<TaskActionResult | null, FormData>(saveTaskAction, null);
  const shown = result?.values ?? values;
  const [type, setType] = useState(values.type);
  const [pbi, setPbi] = useState(values.pbi);
  const [cron, setCron] = useState(values.cron);
  const isDocs = type === "docs";
  const readsRepos = type === "research" && pbi.trim() === "";
  const isEditing = values.scheduleId !== null;
  const isScheduled = isEditing || cron.trim() !== "";

  return (
    <form action={action} className="card">
      {isEditing && <input type="hidden" name="scheduleId" value={values.scheduleId!} />}
      <label>
        Type
        <select name="type" value={type} onChange={(event) => setType(event.target.value)}>
          {types.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label>
        Title
        <input name="title" defaultValue={shown.title} maxLength={120} required />
      </label>
      <label>
        Description: what to do
        <textarea name="description" defaultValue={shown.description} rows={5} required />
      </label>
      <label>
        Acceptance criteria: when it is done
        <textarea name="acceptanceCriteria" defaultValue={shown.acceptanceCriteria} rows={4} required placeholder="e.g. Names the cause, with the code or log that shows it." />
      </label>
      {!isDocs && <label>
        PBI ({PBI_HINTS[type]})
        <input name="pbi" value={pbi} onChange={(event) => setPbi(event.target.value)} placeholder="id or Azure DevOps link" required={PBI_HINTS[type] === "required"} />
      </label>}
      {readsRepos && <RepoChoices repos={repos} checked={shown.repos} />}
      <label>
        Schedule (cron, optional): creates this task on each tick, none while the last one still waits; empty = one task now
        <input name="cron" value={cron} onChange={(event) => setCron(event.target.value)} required={isEditing} placeholder="e.g. 0 7 * * 1" />
      </label>
      {isScheduled && <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={shown.enabled} />
        Enabled (off = only &quot;Create now&quot;)
      </label>}
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : isScheduled ? "Save schedule" : "Create"}</button>
        <Link className="button secondary" href="/tasks">Cancel</Link>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
