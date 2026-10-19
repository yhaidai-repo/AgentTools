"use client";

import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { createNowAction, deleteScheduleAction } from "./schedules/actions";

// "Create now" adds a task to the list below (what happened shows in Last tick); "Delete" asks first.
export function ScheduleActions({ id, name }: { id: number; name: string }) {
  return (
    <div className="actions">
      <form action={createNowAction}>
        <input type="hidden" name="id" value={id} />
        <CreateNowButton />
      </form>
      <form action={deleteScheduleAction} onSubmit={(event) => confirmDelete(event, name)}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="danger small">Delete</button>
      </form>
    </div>
  );
}

function CreateNowButton() {
  const { pending } = useFormStatus();

  return <button type="submit" className="secondary small" disabled={pending}>{pending ? "Creating…" : "Create now"}</button>;
}

function confirmDelete(event: FormEvent<HTMLFormElement>, name: string): void {
  if (!window.confirm(`Delete the scheduled task "${name}"? Tasks it already created stay.`)) {
    event.preventDefault();
  }
}
