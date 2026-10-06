"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addLocalRepoAction } from "./actions";

export function AddLocalRepoForm({ reposRoot }: { reposRoot: string | null }) {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addLocalRepoAction, null);

  return (
    <form action={action}>
      <label>
        Add a local repository: a git checkout&apos;s folder name inside <code>{reposRoot ?? "REPOS_ROOT"}</code>
        <input name="name" placeholder="MyRepo" required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add repository"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}
