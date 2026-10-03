"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { ReviewState } from "@/models/ReviewState";
import { closeReviewAction } from "../actions";
import { QueueReviewButton } from "../QueueReviewButton";

// Start / rerun: a full review of the PR's current commit (also reopens a closed review). Close: local only, with a reason.
export function ReviewActions({ prId, isClosed, state, hasBeenReviewed }: { prId: number; isClosed: boolean; state: ReviewState; hasBeenReviewed: boolean }) {
  const [result, closeAction, isClosing] = useActionState<ActionResult | null, FormData>(closeReviewAction, null);

  return (
    <div className="toolbar">
      <QueueReviewButton prId={prId} state={state} hasBeenReviewed={hasBeenReviewed} />
      {!isClosed && (
        <form action={closeAction} className="actions">
          <input type="hidden" name="prId" value={prId} />
          <input name="reason" placeholder="Reason (optional)" aria-label="Reason for closing" size={26} />
          <button type="submit" className="secondary" disabled={isClosing}>{isClosing ? "Closing…" : "Close review"}</button>
        </form>
      )}
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </div>
  );
}
