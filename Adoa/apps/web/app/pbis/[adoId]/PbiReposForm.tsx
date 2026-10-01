"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { PbiRepoEntry } from "@/models/PbiRepoEntry";
import { saveRepos } from "./actions";

const SOURCES: Record<string, string> = {
  "vault-documented": "documented in the vault",
  "user-confirmed": "confirmed by you",
  "agent-assumed": "refinement's guess, not confirmed",
  added: "added, not saved yet",
  // PBIs refined before repos were recorded: research uses the refinement's list until one is saved here.
  refinement: "refinement's list, not saved yet",
};

// The repos research and design clone for this PBI (user decision 2026-10-02): Remove and "Add a repo" change the list,
// nothing is stored until "Save repos"; saving confirms every repo on it and answers refinement's repo question.
export function PbiReposForm({ adoId, repos, catalog }: { adoId: number; repos: PbiRepoEntry[]; catalog: string[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveRepos, null);
  const [rows, setRows] = useState<PbiRepoEntry[]>(repos);
  const remaining = catalog.filter((name) => !rows.some((row) => row.name === name));

  return (
    <form action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId} />
      {rows.length === 0 && <p className="muted">No repos: research and design clone none for this PBI.</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.name} className={row.source === "agent-assumed" ? "result-error" : undefined}>
            <input type="hidden" name="repo" value={row.name} />
            {row.name} · <span className="muted">{SOURCES[row.source] ?? row.source}</span>{" "}
            <button type="button" className="secondary" onClick={() => setRows(rows.filter((other) => other.name !== row.name))}>Remove</button>
          </li>
        ))}
      </ul>
      {remaining.length > 0 && (
        <select value="" onChange={(event) => setRows([...rows, { name: event.target.value, source: "added", questionId: null }])} aria-label="Add a repo">
          <option value="">Add a repo… ({remaining.length} in the catalog)</option>
          {remaining.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      )}
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save repos"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </form>
  );
}
