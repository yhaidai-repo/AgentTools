import type { SkillCatalog } from "@agenttools/runtime/skills";
import type { SkillFolder } from "@/models/SkillFolder";

// Every skill the agent-runner can load, as checkboxes; a chosen skill that no folder has is flagged, since runs would fail on it.
export function SkillsField({ selected, catalog, folders }: { selected: string[]; catalog: SkillCatalog; folders: SkillFolder[] }) {
  const missing = selected.filter((name) => !catalog.skills.some((skill) => skill.name === name));

  return (
    <fieldset className="field-group">
      <legend>Skills</legend>
      <p className="muted">The agent sees the name and description of each chosen skill and reads its full text only when it calls <code>use_skill</code>.</p>
      {catalog.skills.map((skill) => (
        <label key={skill.name} className="inline choice">
          <input type="checkbox" name="skills" value={skill.name} defaultChecked={selected.includes(skill.name)} />
          <span><strong>{skill.name}</strong> <span className="muted">{skill.description || "(no description)"}</span></span>
        </label>
      ))}
      {missing.map((name) => (
        <label key={name} className="inline choice result-error">
          <input type="checkbox" name="skills" value={name} defaultChecked />
          <span><strong>{name}</strong>: not found in any folder. Runs fail until you add it or untick it.</span>
        </label>
      ))}
      <SkillFolders catalog={catalog} folders={folders} />
    </fieldset>
  );
}

function SkillFolders({ catalog, folders }: { catalog: SkillCatalog; folders: SkillFolder[] }) {
  return (
    <details>
      <summary className="muted">Where skills come from, and how to add one</summary>
      <ol>
        {folders.map((folder) => (
          <li key={folder.path} className={catalog.missingFolders.includes(folder.path) ? "result-error" : undefined}>
            {folder.hostPath}{catalog.missingFolders.includes(folder.path) ? " (not found)" : ""}
          </li>
        ))}
      </ol>
      <p className="muted">
        Add a skill: create <code>&lt;folder&gt;/&lt;skill-name&gt;/SKILL.md</code> with a <code>description:</code> line in its frontmatter, then reload this page.
        When two folders have a skill of the same name, the first folder wins.
      </p>
    </details>
  );
}
