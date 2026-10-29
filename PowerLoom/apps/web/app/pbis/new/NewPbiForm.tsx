"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type FormEvent } from "react";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/models/ActionResult";
import { createPbiAction } from "../actions";

const TYPES = [
  { value: "Product Backlog Item", label: "PBI", tag: "pbi" },
  { value: "Bug", label: "Bug", tag: "bug" },
  { value: "Task", label: "Task", tag: "task" },
];
const PRIORITIES = [1, 2, 3, 4, 5];

// Two columns (user decision 2026-10-18): what the PBI says on the left; what it is, which repos research and design
// clone, and its documents on the right; Create in a bar that stays on screen. The fields keep what you typed when
// creating fails (React clears a form's own fields after its action), and an empty title is told inline.
export function NewPbiForm({ vault, repos, accept }: { vault: string; repos: string[]; accept: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(createPbiAction, null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [type, setType] = useState(TYPES[0].value);
  const [priority, setPriority] = useState(2);
  const [chosenRepos, setChosenRepos] = useState<string[]>([]);
  const [titleProblem, setTitleProblem] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (title.trim() !== "") {
      return;
    }

    event.preventDefault();
    setTitleProblem("Give the PBI a title.");
    titleInput.current?.focus();
  }

  function onTitle(value: string) {
    setTitle(value);
    setTitleProblem(null);
  }

  function toggleRepo(name: string) {
    setChosenRepos(chosenRepos.includes(name) ? chosenRepos.filter((repo) => repo !== name) : [...chosenRepos, name]);
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="new-pbi">
      <div className="new-pbi-columns">
        <div className="panel new-pbi-main">
          <label className="field">
            Title
            <input ref={titleInput} name="title" className="title-input" maxLength={255} value={title} onChange={(event) => onTitle(event.target.value)} placeholder="What should change, in one line" aria-invalid={titleProblem !== null} />
            {titleProblem && <span className="field-problem">{titleProblem}</span>}
          </label>
          <label className="field">
            <span>Description <small>Markdown</small></span>
            <textarea name="descriptionMd" rows={9} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happens now, what should happen, who reported it" />
          </label>
          <label className="field">
            <span>Acceptance criteria <small>Markdown</small></span>
            <textarea name="acceptanceCriteriaMd" rows={6} value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="- When … then …" />
          </label>
        </div>
        <div>
          <div className="panel new-pbi-side">
            <span className="field-label">Type</span>
            <input type="hidden" name="type" value={type} />
            <div className="pill-switch">
              {TYPES.map((choice) => <button key={choice.value} type="button" className={choice.value === type ? `on ${choice.tag}` : undefined} onClick={() => setType(choice.value)}>{choice.label}</button>)}
            </div>
            <span className="field-label">Priority <small>1 = highest</small></span>
            <input type="hidden" name="priority" value={priority} />
            <div className="pill-switch mono">
              {PRIORITIES.map((choice) => <button key={choice} type="button" className={choice === priority ? "on" : undefined} onClick={() => setPriority(choice)}>{choice}</button>)}
            </div>
          </div>
          <div className="panel new-pbi-side">
            <span className="field-label">Repositories <small>what research and planning clone</small></span>
            {repos.length === 0 && <p className="hint">None enabled: turn them on in <Link href="/settings">Settings → Repositories</Link>.</p>}
            <div className="repo-chips">
              {repos.map((name) => <RepoChip key={name} name={name} chosen={chosenRepos.includes(name)} onToggle={toggleRepo} />)}
            </div>
            {chosenRepos.map((name) => <input key={name} type="hidden" name="repo" value={name} />)}
          </div>
          <div className="panel new-pbi-side">
            <span className="field-label">Attachments <small>documents useful for the PBI</small></span>
            <FileInput name="files" accept={accept} />
          </div>
        </div>
      </div>
      <div className="form-footer">
        <span className="form-footer-note">{result && !result.ok ? <span className="text-error">{result.message}</span> : <>Creates a PowerLoom PBI in <b>{vault}</b> · no Azure DevOps item</>}</span>
        <Link className="button secondary" href="/pbis">Cancel</Link>
        <button type="submit" disabled={isSaving}>{isSaving ? "Creating…" : "Create PBI"}</button>
      </div>
    </form>
  );
}

function RepoChip({ name, chosen, onToggle }: { name: string; chosen: boolean; onToggle: (name: string) => void }) {
  return <button type="button" className={chosen ? "repo-chip on" : "repo-chip"} aria-pressed={chosen} onClick={() => onToggle(name)}>{name}</button>;
}
