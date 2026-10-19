"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { ReviewState } from "@/models/ReviewState";
import { queueReview } from "./actions";

// The user starts every review (user decision 2026-10-02): the first one, and a rerun after new pushes or answers. It is
// the review page's primary action.
export function QueueReviewButton({ prId, state, hasBeenReviewed }: { prId: number; state: ReviewState; hasBeenReviewed: boolean }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startQueue] = useTransition();
  const isBusy = state === "queued" || state === "reviewing";

  function onQueue() {
    startQueue(async () => setResult(await queueReview(prId)));
  }

  return (
    <span className="actions">
      <button type="button" onClick={onQueue} disabled={isPending || isBusy}>{buttonLabel(isPending, isBusy, hasBeenReviewed)}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </span>
  );
}

function buttonLabel(isPending: boolean, isBusy: boolean, hasBeenReviewed: boolean): string {
  if (isPending) {
    return "Queuing…";
  }

  if (isBusy) {
    return "In queue";
  }

  return hasBeenReviewed ? "Rerun review" : "Start review";
}
