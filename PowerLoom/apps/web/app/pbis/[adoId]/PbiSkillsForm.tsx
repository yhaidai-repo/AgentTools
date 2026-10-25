"use client";

import { useActionState, useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import type { PbiSkill } from "@powerloom/db";
import type { SkillSummary } from "@agenttools/runtime/skills";
import type { ActionResult } from "@/models/ActionResult";
import { saveSkills } from "./actions";
import { KeptForm } from "@/components/KeptForm";

interface SkillRow {
  name: string;
  description: string;
  chosen?: PbiSkill;
  isMissing: boolean;
}

// Only the PBI's skills are listed (user decision 2026-10-01): "Remove" shrinks the list, the "Add a skill" picker
// extends it with one more; nothing is stored until "Save skills". A chosen skill no folder has any more stays, flagged.
export function PbiSkillsForm({ adoId, skills, catalog }: { adoId: number; skills: PbiSkill[]; catalog: SkillSummary[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveSkills, null);
  const [rows, setRows] = useState<SkillRow[]>(() => chosenRows(skills, catalog));
  const remaining = catalog.filter((entry) => !rows.some((row) => row.name === entry.name));

  function add(name: string) {
    const entry = catalog.find((candidate) => candidate.name === name);

    if (entry) {
      setRows([...rows, { name: entry.name, description: entry.description, isMissing: false }]);
    }
  }

  return (
    <KeptForm action={action} className="close-item">
      <input type="hidden" name="adoId" value={adoId} />
      {rows.length === 0 && <p className="muted">No skills: later agents use only their configured ones.</p>}
      {rows.map((row) => <SkillOption key={row.name} row={row} onRemove={() => setRows(rows.filter((other) => other.name !== row.name))} />)}
      {remaining.length > 0 && (
        <Dropdown label="Add a skill" pill trigger={<span>+ Add skill</span>}>
          <div className="menu-title">{remaining.length} available</div>
          {remaining.map((entry) => <button key={entry.name} type="button" className="menu-item" role="menuitem" title={entry.description} onClick={() => add(entry.name)}>{entry.name}</button>)}
        </Dropdown>
      )}
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save skills"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}

function SkillOption({ row, onRemove }: { row: SkillRow; onRemove: () => void }) {
  return (
    <div className={`skill-choice${row.isMissing ? " result-error" : ""}`}>
      <input type="hidden" name="skill" value={row.name} />
      <span>
        <span>
          <strong>{row.name}</strong>
          {row.chosen && <span className="muted"> ({row.chosen.by === "user" ? "you" : "refinement"})</span>}
          {" "}<button type="button" className="chip-remove" aria-label={`Remove ${row.name}`} onClick={onRemove}>×</button>
        </span>
        <span className="muted clamp" title={row.description}>{row.description}</span>
        <input name={`reason:${row.name}`} placeholder="Why it helps on this PBI" defaultValue={row.chosen?.reason ?? ""} />
      </span>
    </div>
  );
}

function chosenRows(skills: PbiSkill[], catalog: SkillSummary[]): SkillRow[] {
  return skills.map((skill) => {
    const entry = catalog.find((candidate) => candidate.name === skill.name);

    return { name: skill.name, description: entry?.description ?? "not found in any skill folder: agents skip it", chosen: skill, isMissing: !entry };
  });
}
