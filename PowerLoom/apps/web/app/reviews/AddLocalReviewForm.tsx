"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addLocalReview } from "./actions";
import type { AddReviewRepo } from "./AddReviewForm";
import { KeptForm } from "@/components/KeptForm";

// Reviews → Add local review (user decision 2026-10-25): a branch of a local repo against a base branch, like a pull
// request without one; no Azure DevOps needed. Each run reviews the branch's head at its start.
export function AddLocalReviewForm({ repos }: { repos: AddReviewRepo[] }) {
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(addLocalReview, null);
  const defaultBranch = repos.find((entry) => entry.name === repo)?.defaultBranch?.replace(/^refs\/heads\//, "") ?? "main";

  if (!open) {
    return <button type="button" className="secondary" onClick={() => setOpen(true)} title="Review a branch of a local repo against its base">Add local review</button>;
  }

  return (
    <KeptForm action={action} clearOn={result} className="add-review-form">
      <select name="repo" value={repo} onChange={(event) => setRepo(event.target.value)} aria-label="Local repository">
        {repos.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}
      </select>
      <input name="branch" required placeholder="Branch, e.g. feature/30474-other-payer" aria-label="Branch" />
      <input name="baseBranch" placeholder={`Base (${defaultBranch})`} aria-label="Base branch" title="What the branch is compared with" />
      <input name="pbi" placeholder="PBI (optional)" aria-label="PBI" title="The review's PBI; empty: the number in the branch name" />
      <button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add"}</button>
      <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </KeptForm>
  );
}
