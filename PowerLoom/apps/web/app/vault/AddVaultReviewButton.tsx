"use client";

import { useState, useTransition } from "react";
import { addVaultReviewScheduleAction } from "./actions";

export function AddVaultReviewButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(): void {
    startTransition(async () => {
      const result = await addVaultReviewScheduleAction();

      setMessage(result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" onClick={add} disabled={isPending}>{isPending ? "Scheduling…" : "Add vault review"}</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}
