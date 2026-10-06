"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { ReviewState } from "@/models/ReviewState";
import { closeReview, deleteReview } from "./actions";
import { QueueReviewButton } from "./QueueReviewButton";

// Start / rerun, Close and Delete for one review, on the grid and on the review page (user decision 2026-10-06).
export function ReviewRowActions({ prId, state, hasBeenReviewed, isClosed, afterDelete }: { prId: number; state: ReviewState; hasBeenReviewed: boolean; isClosed: boolean; afterDelete: "refresh" | "list" }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClose(): void {
    startTransition(async () => {
      setResult(await closeReview(prId));
      router.refresh();
    });
  }

  function onDelete(): void {
    if (!window.confirm(`Delete the review of PR ${prId} from adoa? Its comments, tasks and runs are removed, and the pull request check won't list the PR again. Azure DevOps is not changed.`)) {
      return;
    }

    startTransition(async () => {
      const deleted = await deleteReview(prId);

      setResult(deleted);

      if (deleted.ok) {
        afterDelete === "list" ? router.push("/reviews") : router.refresh();
      }
    });
  }

  return (
    <span className="actions">
      <QueueReviewButton prId={prId} state={state} hasBeenReviewed={hasBeenReviewed} />
      {!isClosed && <button type="button" className="secondary" disabled={isPending} onClick={onClose}>Close</button>}
      <button type="button" className="secondary" disabled={isPending} onClick={onDelete}>Delete</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </span>
  );
}
