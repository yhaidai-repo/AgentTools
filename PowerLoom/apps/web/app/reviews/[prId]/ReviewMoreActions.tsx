"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Dropdown } from "@/components/Dropdown";
import type { ActionResult } from "@/models/ActionResult";
import { closeReviewAction, deleteReview } from "../actions";
import { KeptForm } from "@/components/KeptForm";

// The header's ⋯ menu (user decision 2026-10-18): Close asks for an optional reason in a small form under the actions
// (the menu closes on a click, so the field can't live in it); Delete asks first, then goes back to the list.
export function ReviewMoreActions({ prId, isClosed }: { prId: number; isClosed: boolean }) {
  const router = useRouter();
  const [isClosing, setClosing] = useState(false);
  const [deleted, setDeleted] = useState<ActionResult | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete the review of PR ${prId} from PowerLoom? Its comments, tasks and runs are removed, and the pull request check won't list the PR again. Azure DevOps is not changed.`)) {
      return;
    }

    startDelete(async () => {
      const result = await deleteReview(prId);

      setDeleted(result);

      if (result.ok) {
        router.push("/reviews");
      }
    });
  }

  return (
    <>
      <Dropdown label="More actions" align="right" pill trigger={<span aria-hidden="true">⋯</span>}>
        {!isClosed && <button type="button" className="menu-item" role="menuitem" onClick={() => setClosing(true)}>Close…</button>}
        {!isClosed && <div className="menu-sep" />}
        <button type="button" className="menu-item danger-item" role="menuitem" onClick={onDelete} disabled={isDeleting}>Delete…</button>
      </Dropdown>
      {deleted && !deleted.ok && <span className="result-error">{deleted.message}</span>}
      {isClosing && <CloseForm prId={prId} onCancel={() => setClosing(false)} />}
    </>
  );
}

// Local only: Azure DevOps isn't told (user decision 2026-10-02); starting a review reopens it.
function CloseForm({ prId, onCancel }: { prId: number; onCancel: () => void }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(closeReviewAction, null);

  return (
    <KeptForm action={action} clearOn={result} className="close-review-form">
      <input type="hidden" name="prId" value={prId} />
      <input name="reason" placeholder="Reason (optional)" aria-label="Reason for closing" autoFocus />
      <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Closing…" : "Close review"}</button>
      <button type="button" className="link-button" onClick={onCancel}>Cancel</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </KeptForm>
  );
}
