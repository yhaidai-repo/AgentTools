"use client";

import type { RepoRow } from "@adoa/core";
import { useTransition } from "react";
import { removeLocalRepoAction, setRepoEnabledAction } from "./actions";

// One catalog repo: its switch saves at once; a local repo can be removed (an ADO one comes back with the next sync).
export function RepoRowForm({ repo }: { repo: RepoRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className={repo.excluded ? "muted" : undefined}>
      <td>
        <input type="checkbox" checked={!repo.excluded} disabled={isPending} onChange={(event) => startTransition(() => setRepoEnabledAction(repo.id, event.target.checked))} />
      </td>
      <td>{repo.name}</td>
      <td>{repo.kind === "local" ? "local" : `ADO: ${repo.adoProject}`}</td>
      <td>{repo.defaultBranch?.replace(/^refs\/heads\//, "") ?? "–"}</td>
      <td>{repo.kind === "local" && <button type="button" disabled={isPending} onClick={() => startTransition(() => removeLocalRepoAction(repo.id))}>Remove</button>}</td>
    </tr>
  );
}
