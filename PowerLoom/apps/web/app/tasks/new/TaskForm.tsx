"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import type { TaskActionResult } from "@/models/TaskActionResult";
import type { TaskFormValues } from "@/models/TaskFormValues";
import { RepoChoices } from "../RepoChoices";
import { saveTaskAction } from "./actions";

const PBI_HINTS: Record<string, string> = {
  refinement: "required",
  design: "required",
  research: "optional; without one, the agent reads the repositories",
  test: "required; a PBI or bug id",
};

const REQUIRED_FIELDS = [
  { name: "title", problem: "Give the task a title." },
  { name: "description", problem: "Say what to do." },
  { name: "acceptanceCriteria", problem: "Say when it is done." },
];

// A task for any agent that takes its type (user decision 2026-10-14): what to do, when it is done, and what it works
// on. Refinement and design need a PBI; research may have one; docs names no note, the tech-writer finds the notes
// (user decision 2026-10-15); the vault review works on the vault (user decision 2026-10-18). With a cron the form saves
// a schedule that creates this task on each tick instead. A refused save shows what was typed again: React resets a form
// after its action, to the defaults rendered then. Laid out like New PBI (user decision 2026-10-18): what the task says
// on the left, its type, PBI, repos and schedule on the right, Create in a bar that stays on screen; an empty field is
// told inline.
// `customTypes`: the types agents made in the UI brought (user decision 2026-10-24); like research, they read repos when
// the task has no PBI.
export function TaskForm({ values, types, customTypes = [], repos }: { values: TaskFormValues; types: string[]; customTypes?: string[]; repos: string[] }) {
  const [result, action, isSaving] = useActionState<TaskActionResult | null, FormData>(saveTaskAction, null);
  const shown = result?.values ?? values;
  const [type, setType] = useState(values.type);
  const [pbi, setPbi] = useState(values.pbi);
  const [cron, setCron] = useState(values.cron);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const pbiHint = PBI_HINTS[type];
  const readsRepos = (type === "research" || customTypes.includes(type)) && pbi.trim() === "";
  const isEditing = values.scheduleId !== null;
  const isScheduled = isEditing || cron.trim() !== "";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const found = missingFields(new FormData(event.currentTarget));

    setProblems(found);

    if (Object.keys(found).length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="new-pbi">
      {isEditing && <input type="hidden" name="scheduleId" value={values.scheduleId!} />}
      <div className="new-pbi-columns">
        <div className="panel new-pbi-main">
          <Field label="Title" problem={problems.title}><input name="title" className="title-input" defaultValue={shown.title} maxLength={120} placeholder="What the agent should do, in one line" aria-invalid={Boolean(problems.title)} /></Field>
          <Field label="Description" hint="what to do" problem={problems.description}><textarea name="description" defaultValue={shown.description} rows={7} aria-invalid={Boolean(problems.description)} /></Field>
          <Field label="Acceptance criteria" hint="when it is done" problem={problems.acceptanceCriteria}><textarea name="acceptanceCriteria" defaultValue={shown.acceptanceCriteria} rows={5} placeholder="Names the cause, with the code or log that shows it." aria-invalid={Boolean(problems.acceptanceCriteria)} /></Field>
        </div>
        <div>
          <div className="panel new-pbi-side">
            <span className="field-label">Type</span>
            <input type="hidden" name="type" value={type} />
            <div className="pill-switch">
              {types.map((name) => <button key={name} type="button" className={name === type ? "on" : undefined} onClick={() => setType(name)}>{name}</button>)}
            </div>
            {pbiHint && <Field label="PBI" hint={pbiHint}><input name="pbi" value={pbi} onChange={(event) => setPbi(event.target.value)} placeholder="id or Azure DevOps link" /></Field>}
          </div>
          {readsRepos && <RepoChoices repos={repos} checked={shown.repos} />}
          <div className="panel new-pbi-side">
            <Field label="Schedule" hint="cron, optional: creates this task on each tick, none while the last one still waits; empty = one task now"><input name="cron" value={cron} onChange={(event) => setCron(event.target.value)} placeholder="0 7 * * 1" /></Field>
            {isScheduled && <label className="inline"><input type="checkbox" name="enabled" defaultChecked={shown.enabled} />Enabled (off = only &quot;Create now&quot;)</label>}
          </div>
        </div>
      </div>
      <div className="form-footer">
        <span className="form-footer-note">{result ? <span className={result.ok ? "text-ok" : "text-error"}>{result.message}</span> : isScheduled ? "Saves a schedule" : "Creates one task now"}</span>
        <Link className="button secondary" href="/tasks">Cancel</Link>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : isScheduled ? "Save schedule" : "Create"}</button>
      </div>
    </form>
  );
}

function Field({ label, hint, problem, children }: { label: string; hint?: string; problem?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      {children}
      {problem && <span className="field-problem">{problem}</span>}
    </label>
  );
}

// The fields the task can't do without, each with what to tell when it is empty.
function missingFields(form: FormData): Record<string, string> {
  const empty = REQUIRED_FIELDS.filter((field) => String(form.get(field.name) ?? "").trim() === "");

  return Object.fromEntries(empty.map((field) => [field.name, field.problem]));
}
