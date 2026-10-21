"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { finishPbiAction } from "@/app/pbis/actions";
import type { PbiToFinish } from "@/models/PbiToFinish";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Finishing asks how it went, once per PBI (user decision 2026-10-05): the agents' rating 1–10 and the user's hours are
// required; "what went wrong" is optional and becomes a WWW record with the chosen fault.
export function FinishDialog({ pbis, onDone }: { pbis: PbiToFinish[]; onDone: (messages: string[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function next(message: string) {
    const all = [...messages, message];

    if (index + 1 < pbis.length) {
      setMessages(all);
      setIndex(index + 1);

      return;
    }

    dialog.current?.close();
    onDone(all);
  }

  function cancel() {
    dialog.current?.close();
    onDone(messages);
  }

  return (
    <dialog ref={dialog} className="modal" onCancel={cancel}>
      <FinishForm key={pbis[index].adoId} pbi={pbis[index]} step={pbis.length > 1 ? `${index + 1} of ${pbis.length}` : null} onFinished={next} onSkip={() => next(`PBI-${pbis[index].adoId} skipped.`)} onCancel={cancel} />
    </dialog>
  );
}

interface FinishFormProps {
  pbi: PbiToFinish;
  step: string | null;
  onFinished: (message: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

function FinishForm({ pbi, step, onFinished, onSkip, onCancel }: FinishFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [effort, setEffort] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [fault, setFault] = useState<"Agent" | "Human">("Agent");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isComplete = rating !== null && effort.trim() !== "" && Number(effort) >= 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating === null) {
      return;
    }

    startTransition(async () => {
      const result = await finishPbiAction({ adoId: pbi.adoId, rating, effortHours: Number(effort), whatWentWrong: whatWentWrong.trim() || null, fault });

      setError(result.ok ? null : result.message);

      if (result.ok) {
        onFinished(result.message);
      }
    });
  }

  return (
    <form method="dialog" className="finish-form" onSubmit={onSubmit}>
      <h2>Finish PBI-{pbi.adoId}{step && <span className="muted"> · {step}</span>}</h2>
      <p className="muted">{pbi.title}</p>
      <fieldset className="rating">
        <legend>How well did the agents do? (1 = poor, 10 = excellent)</legend>
        {RATINGS.map((value) => <RatingChoice key={value} value={value} selected={rating === value} onSelect={setRating} />)}
      </fieldset>
      <label>
        Your effort (hours)
        <input type="number" min="0" step="0.25" required value={effort} onChange={(event) => setEffort(event.target.value)} />
      </label>
      <label>
        What went wrong (optional, logged as a WWW record)
        <textarea rows={3} value={whatWentWrong} onChange={(event) => setWhatWentWrong(event.target.value)} />
      </label>
      {whatWentWrong.trim() && <FaultChoice fault={fault} onChange={setFault} />}
      <p className="muted">The PBI becomes done in PowerLoom; its open tasks and questions are cancelled, findings stay. Azure DevOps is not changed.</p>
      {error && <p className="result-error">{error}</p>}
      <p className="actions">
        <button type="submit" disabled={!isComplete || isPending}>{isPending ? "Finishing…" : "Finish"}</button>
        {step && <button type="button" className="secondary" onClick={onSkip} disabled={isPending}>Skip</button>}
        <button type="button" className="secondary" onClick={onCancel} disabled={isPending}>Cancel</button>
      </p>
    </form>
  );
}

function RatingChoice({ value, selected, onSelect }: { value: number; selected: boolean; onSelect: (value: number) => void }) {
  return (
    <button type="button" className={selected ? "rating-choice selected" : "rating-choice secondary"} aria-pressed={selected} onClick={() => onSelect(value)}>{value}</button>
  );
}

function FaultChoice({ fault, onChange }: { fault: "Agent" | "Human"; onChange: (fault: "Agent" | "Human") => void }) {
  return (
    <label>
      Whose fault
      <select value={fault} onChange={(event) => onChange(event.target.value as "Agent" | "Human")}>
        <option value="Agent">Agent</option>
        <option value="Human">Human</option>
      </select>
    </label>
  );
}
