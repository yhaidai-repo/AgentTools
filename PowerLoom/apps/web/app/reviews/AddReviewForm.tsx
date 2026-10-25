"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addReview } from "./actions";
import { KeptForm } from "@/components/KeptForm";

export interface AddReviewRepo {
  name: string;
  defaultBranch: string | null;
}

// Reviews → Add review (user decision 2026-10-21): a branch of an Azure DevOps repo. PowerLoom adds the active pull
// request from it, or a branch review when there is none (diffed against the target, default: the repo's default).
export function AddReviewForm({ repos }: { repos: AddReviewRepo[] }) {
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(addReview, null);
  const defaultBranch = repos.find((entry) => entry.name === repo)?.defaultBranch?.replace(/^refs\/heads\//, "") ?? "main";

  if (!open) {
    return <button type="button" className="secondary" onClick={() => setOpen(true)} disabled={repos.length === 0} title={repos.length === 0 ? "No enabled Azure DevOps repository (Settings → Repositories)" : "Add a review of a branch"}>Add review</button>;
  }

  return (
    <KeptForm action={action} clearOn={result} className="add-review-form">
      <select name="repo" value={repo} onChange={(event) => setRepo(event.target.value)} aria-label="Repository">
        {repos.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}
      </select>
      <input name="branch" required placeholder="Branch, e.g. feature/30474-new-report" aria-label="Branch" />
      <input name="targetBranch" placeholder={`Target (${defaultBranch})`} aria-label="Target branch" title="What a branch review is compared with; a PR keeps its own target" />
      <input name="pbi" placeholder="PBI (optional)" aria-label="PBI" title="A branch review's PBI; empty: the number in the branch name" />
      <button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add"}</button>
      <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </KeptForm>
  );
}
