"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { addLocalRepoAction } from "./actions";

// Folded until wanted (user decision 2026-10-18): a git checkout's folder name inside the repos root.
export function AddLocalRepoForm({ reposRoot }: { reposRoot: string | null }) {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addLocalRepoAction, null);

  return (
    <details className="add-form">
      <summary>+ Add a local repository</summary>
      <form action={action}>
        <label className="field"><span>Folder name<small>a git checkout inside {reposRoot ?? "REPOS_ROOT"}</small></span><input name="name" placeholder="MyRepo" required /></label>
        <div className="actions">
          <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add repository"}</button>
          <ResultLine result={result} />
        </div>
      </form>
    </details>
  );
}
