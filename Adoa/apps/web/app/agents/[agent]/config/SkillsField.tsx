"use client";

import { useState } from "react";
import type { SkillCatalog, SkillSummary } from "@agenttools/runtime/skills";
import type { SkillFolder } from "@/models/SkillFolder";

interface SkillsFieldProps {
  agentId: string;
  selected: string[];
  catalog: SkillCatalog;
  folders: SkillFolder[];
}

// Only the agent's skills are listed (as on the PBI page): "Remove" shrinks the list, "Add a skill" extends it; the agent
// form's Save stores it. A chosen skill no folder has is flagged, since runs fail on it.
export function SkillsField({ agentId, selected, catalog, folders }: SkillsFieldProps) {
  const [names, setNames] = useState(selected);
  const remaining = catalog.skills.filter((skill) => !names.includes(skill.name));
  const editableFolders = folders.filter((folder) => folder.editable).map((folder) => folder.path);

  return (
    <fieldset className="field-group">
      <legend>Skills</legend>
      <p className="muted">The agent sees the name and description of each chosen skill and reads its full text only when it calls <code>use_skill</code>.</p>
      {names.length === 0 && <p className="muted">None.</p>}
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
        <select value="" onChange={(event) => setNames(event.target.value ? [...names, event.target.value] : names)} aria-label="Add a skill">
          <option value="">Add a skill… ({remaining.length} available)</option>
          {remaining.map((skill) => <option key={skill.name} value={skill.name} title={skill.description}>{skill.name}</option>)}
        </select>
      )}
      <SkillFolders catalog={catalog} folders={folders} />
    </fieldset>
  );
}

interface ChosenSkillProps {
  agentId: string;
  name: string;
  skill?: SkillSummary;
  editableFolders: string[];
  onRemove: () => void;
}

// adoa's own skills open in the editor; the others (e.g. personal Claude Code skills) are view-only.
function ChosenSkill({ agentId, name, skill, editableFolders, onRemove }: ChosenSkillProps) {
  const linkLabel = skill && editableFolders.includes(skill.folder) ? "view / edit" : "view";

  return (
    <div className={`skill-choice${skill ? "" : " result-error"}`}>
      <input type="hidden" name="skills" value={name} />
      <span>
        <span>
          <strong>{name}</strong>
          {skill && <> <a href={`/skills/${name}?agent=${agentId}`}>{linkLabel}</a></>}
          {" "}<button type="button" className="secondary" onClick={onRemove}>Remove</button>
        </span>
        <span className="muted clamp" title={skill?.description}>{skill ? skill.description || "(no description)" : "not found in any folder: runs fail until you add it or remove it here"}</span>
      </span>
    </div>
  );
}

function SkillFolders({ catalog, folders }: { catalog: SkillCatalog; folders: SkillFolder[] }) {
  return (
    <details>
      <summary className="muted">Where skills come from, and how to add one</summary>
      <ol>
        {folders.map((folder) => (
          <li key={folder.path} className={catalog.missingFolders.includes(folder.path) ? "result-error" : undefined}>
            {folder.hostPath}{catalog.missingFolders.includes(folder.path) ? " (not found)" : ""}{folder.editable ? " · editable here" : " · view only here"}
          </li>
        ))}
      </ol>
      <p className="muted">
        adoa edits existing skills of its own folder only. To add a skill, create <code>&lt;folder&gt;/&lt;skill-name&gt;/SKILL.md</code> with a <code>description:</code> line in its frontmatter, then reload this page.
        When two folders have a skill of the same name, the first folder wins.
      </p>
    </details>
  );
}
