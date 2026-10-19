"use client";

import { useState } from "react";
import type { SkillCatalog, SkillSummary } from "@agenttools/runtime/skills";
import { Dropdown } from "@/components/Dropdown";
import type { SkillFolder } from "@/models/SkillFolder";

interface SkillsFieldProps {
  agentId: string;
  selected: string[];
  catalog: SkillCatalog;
  folders: SkillFolder[];
}

// Only the agent's skills are listed (as on the PBI page), as chips: × shrinks the list, "Add a skill" extends it; the
// agent form's Save stores it. A chosen skill no folder has is flagged, since runs fail on it.
export function SkillsField({ agentId, selected, catalog, folders }: SkillsFieldProps) {
  const [names, setNames] = useState(selected);
  const remaining = catalog.skills.filter((skill) => !names.includes(skill.name));
  const editableFolders = folders.filter((folder) => folder.editable).map((folder) => folder.path);

  return (
    <section className="panel config-section">
      <h3>Skills <small>it reads a skill&apos;s full text only when it calls use_skill</small></h3>
      <div className="chip-list">
        {names.map((name) => (
          <ChosenSkill
            key={name}
            agentId={agentId}
            name={name}
            skill={catalog.skills.find((skill) => skill.name === name)}
            editableFolders={editableFolders}
            onRemove={() => setNames(names.filter((other) => other !== name))}
          />
        ))}
        {remaining.length > 0 && (
          <Dropdown label="Add a skill" pill trigger={<span>Add a skill <span className="text-faint">{remaining.length}</span></span>}>
            {remaining.map((skill) => (
              <button key={skill.name} type="button" className="menu-item" role="menuitem" onClick={() => setNames([...names, skill.name])}>
                <span className="menu-text">{skill.name}<small>{skill.description}</small></span>
              </button>
            ))}
          </Dropdown>
        )}
      </div>
      {names.length === 0 && <p className="hint">None yet.</p>}
      <SkillFolders catalog={catalog} folders={folders} />
    </section>
  );
}

interface ChosenSkillProps {
  agentId: string;
  name: string;
  skill?: SkillSummary;
  editableFolders: string[];
  onRemove: () => void;
}

// PowerLoom's own skills open in the editor; the others (e.g. personal Claude Code skills) are view-only.
function ChosenSkill({ agentId, name, skill, editableFolders, onRemove }: ChosenSkillProps) {
  const linkLabel = skill && editableFolders.includes(skill.folder) ? "view / edit" : "view";

  return (
    <span className={`skill-chip${skill ? "" : " missing"}`} title={skill ? skill.description || "(no description)" : "not found in any folder: runs fail until you add it or remove it here"}>
      <input type="hidden" name="skills" value={name} />
      {skill ? <a href={`/skills/${name}?agent=${agentId}`} title={linkLabel}>{name}</a> : name}
      <button type="button" className="skill-remove" onClick={onRemove} aria-label={`Remove ${name}`}>×</button>
    </span>
  );
}

function SkillFolders({ catalog, folders }: { catalog: SkillCatalog; folders: SkillFolder[] }) {
  return (
    <details className="skill-folders">
      <summary className="hint">Where skills come from, and how to add one</summary>
      <ol>
        {folders.map((folder) => (
          <li key={folder.path} className={catalog.missingFolders.includes(folder.path) ? "result-error" : undefined}>
            {folder.hostPath}{catalog.missingFolders.includes(folder.path) ? " (not found)" : ""}{folder.editable ? " · editable here" : " · view only here"}
          </li>
        ))}
      </ol>
      <p className="hint">
        PowerLoom edits existing skills of its own folder only. To add a skill, create <code>&lt;folder&gt;/&lt;skill-name&gt;/SKILL.md</code> with a <code>description:</code> line in its frontmatter, then reload this page.
        When two folders have a skill of the same name, the first folder wins.
      </p>
    </details>
  );
}
