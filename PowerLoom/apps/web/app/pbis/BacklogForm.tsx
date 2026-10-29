"use client";

import { startTransition, useActionState, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { FinishDialog } from "@/components/FinishDialog";
import { confirmedClick } from "@/lib/confirmSubmit";
import type { ActionResult } from "@/models/ActionResult";
import type { PbiToFinish } from "@/models/PbiToFinish";
import { closeSelected, deleteSelected, planSelected, prepareSelected, reopenSelected } from "./actions";
import { StartButton } from "./StartButton";

// Wraps the server-rendered table so its row checkboxes submit with this form. The actions live in a bar that shows
// only while rows are ticked (user decision 2026-10-18), sliding in; each button explains itself in its tooltip. Start
// prepares the selected PBIs for refinement, or from its menu for planning; Finish goes through the Finish dialog, one
// PBI at a time.
export function BacklogForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [prepared, prepareAction, isPreparing] = useActionState<ActionResult | null, FormData>(prepareSelected, null);
  const [planned, planAction, isPlanning] = useActionState<ActionResult | null, FormData>(planSelected, null);
  const [deleted, deleteAction, isDeleting] = useActionState<ActionResult | null, FormData>(deleteSelected, null);
  const [closed, closeAction, isClosing] = useActionState<ActionResult | null, FormData>(closeSelected, null);
  const [reopened, reopenAction, isReopening] = useActionState<ActionResult | null, FormData>(reopenSelected, null);
  const [toFinish, setToFinish] = useState<PbiToFinish[] | null>(null);
  const [finished, setFinished] = useState<string | null>(null);

  function onFinish() {
    const pbis = selectedPbis(form.current);

    setFinished(null);
    setToFinish(pbis.length > 0 ? pbis : null);
  }

  function onFinishDone(messages: string[]) {
    setToFinish(null);
    setFinished(messages.join(" ") || null);
  }

  // The menu's item unmounts on its click, so both actions run from the form's current ticks rather than a submit.
  function startWith(action: (data: FormData) => void) {
    startTransition(() => action(new FormData(form.current ?? undefined)));
  }

  function onClear() {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(untick);
    setSelected(0);
  }

  // The dialog has its own form, so it stays outside this one (forms can't nest).
  return (
    <>
      <form ref={form} action={prepareAction} onChange={() => setSelected(selectedPbis(form.current).length)}>
        <div className={`selection-bar${selected > 0 ? " show" : ""}`} aria-hidden={selected === 0}>
          <span key={selected} className="selection-count">{selected} selected</span>
          <StartButton isPending={isPreparing || isPlanning} onRefine={() => startWith(prepareAction)} onPlan={() => startWith(planAction)} />
          <button type="button" className="secondary" onClick={onFinish} title="Marks the PBIs done in PowerLoom; asks for your effort">Finish</button>
          <button type="submit" className="secondary" formAction={closeAction} disabled={isClosing} onClick={confirmClose} title="Keeps them for the agents to read but stops all work on them">{isClosing ? "Closing…" : "Close"}</button>
          <button type="submit" className="secondary" formAction={reopenAction} disabled={isReopening} title="Brings closed PBIs back as new">{isReopening ? "Reopening…" : "Reopen"}</button>
          <button type="submit" className="danger" formAction={deleteAction} disabled={isDeleting} onClick={confirmDelete} title="Removes them from PowerLoom only; Azure DevOps is not changed">{isDeleting ? "Deleting…" : "Delete"}</button>
          <button type="button" className="link-button selection-clear" onClick={onClear}>Clear</button>
        </div>
        <ActionResults results={[prepared, planned, deleted, closed, reopened]} finished={finished} />
        {children}
      </form>
      {toFinish && <FinishDialog pbis={toFinish} onDone={onFinishDone} />}
    </>
  );
}

// The last answer of each action, kept in view after the bar folds away.
function ActionResults({ results, finished }: { results: (ActionResult | null)[]; finished: string | null }) {
  const shown = results.filter((result): result is ActionResult => result !== null);

  if (shown.length === 0 && !finished) {
    return null;
  }

  return (
    <p className="action-results">
      {shown.map((result) => <span key={result.message} className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>)}
      {finished && <span className="muted">{finished}</span>}
    </p>
  );
}

// Asks first: the selected PBIs and everything PowerLoom made for them go; sync won't bring them back (ADO stays untouched).
function confirmDelete(event: MouseEvent<HTMLButtonElement>): void {
  const count = selectedPbis(event.currentTarget.form).length;

  if (count === 0) {
    event.preventDefault();

    return;
  }

  confirmedClick(event, { title: `Delete ${count} PBI(s) from PowerLoom?`, message: "Their child items, tasks, questions, runs, attachments, repos and notes are removed; Azure DevOps is not changed.", confirmLabel: "Delete", isDanger: true });
}

// Asks first: the selected PBIs stop (open tasks and questions cancelled, open children closed); ADO stays untouched.
function confirmClose(event: MouseEvent<HTMLButtonElement>): void {
  const count = selectedPbis(event.currentTarget.form).length;

  if (count === 0) {
    event.preventDefault();

    return;
  }

  confirmedClick(event, { title: `Close ${count} PBI(s) in PowerLoom?`, message: "Their open tasks and questions are cancelled and their open child items close with them. They stay for the agents to read; Azure DevOps is not changed.", confirmLabel: "Close", isDanger: true });
}

// The ticked rows; each checkbox carries its PBI's title for the dialog.
function selectedPbis(form: HTMLFormElement | null): PbiToFinish[] {
  const checked = form ? [...form.querySelectorAll<HTMLInputElement>('input[name="adoId"]:checked')] : [];

  return checked.map((input) => ({ adoId: Number(input.value), title: input.dataset.title ?? "" }));
}

function untick(box: HTMLInputElement): void {
  box.checked = false;
}
