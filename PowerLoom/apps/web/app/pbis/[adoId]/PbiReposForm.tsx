"use client";

import { useActionState, useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import type { ActionResult } from "@/models/ActionResult";
import type { PbiRepoEntry } from "@/models/PbiRepoEntry";
import { saveRepos } from "./actions";
import { KeptForm } from "@/components/KeptForm";

const SOURCES: Record<string, string> = {
  "vault-documented": "documented in the vault",
  "user-confirmed": "confirmed by you",
  "agent-assumed": "refinement's guess, not confirmed",
  added: "added, not saved yet",
  // PBIs refined before repos were recorded: research uses the refinement's list until one is saved here.
  refinement: "refinement's list, not saved yet",
};

// The repos research and design clone for this PBI (user decision 2026-10-02): × and "+ Add repo" change the chips,
// nothing is stored until "Save repos"; saving confirms every repo on it and answers refinement's repo question. A
// refinement guess not confirmed yet is an amber chip.
export function PbiReposForm({ adoId, repos, catalog }: { adoId: number; repos: PbiRepoEntry[]; catalog: string[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveRepos, null);
  const [rows, setRows] = useState<PbiRepoEntry[]>(repos);
  const remaining = catalog.filter((name) => !rows.some((row) => row.name === name));

  return (
    <KeptForm action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId} />
      {rows.length === 0 && <p className="empty">No repos: research and design clone none for this PBI.</p>}
      <div className="chip-list">
        {rows.map((row) => (
          <span key={row.name} className={row.source === "agent-assumed" ? "pick-chip guess" : "pick-chip"} title={SOURCES[row.source] ?? row.source}>
            <input type="hidden" name="repo" value={row.name} />
            {row.name}
            <button type="button" className="chip-remove" aria-label={`Remove ${row.name}`} onClick={() => setRows(rows.filter((other) => other.name !== row.name))}>×</button>
          </span>
        ))}
        {remaining.length > 0 && (
          <Dropdown label="Add a repo" pill trigger={<span>+ Add repo</span>}>
            <div className="menu-title">{remaining.length} in the catalog</div>
            {remaining.map((name) => <button key={name} type="button" className="menu-item" role="menuitem" onClick={() => setRows([...rows, { name, source: "added", questionId: null }])}>{name}</button>)}
          </Dropdown>
        )}
      </div>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save repos"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}
