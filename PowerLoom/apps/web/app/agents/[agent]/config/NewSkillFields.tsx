"use client";

import { useState } from "react";

// A skill written with the agent (user decision 2026-10-23): a folder of PowerLoom's own under its skills folder, its
// SKILL.md from the description and the text here; the agent gets it in its skills.
export function NewSkillFields({ suggestedName }: { suggestedName: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <p className="field-hint"><button type="button" className="link" onClick={() => setOpen(true)}>New skill for this agent…</button></p>;
  }

  return (
    <fieldset className="new-skill">
      <legend>New skill</legend>
      <label className="field"><span>Name</span><input name="newSkillName" pattern="[a-z0-9][a-z0-9-]*" placeholder={suggestedName || "my-agent-checklist"} /></label>
      <label className="field"><span>Description</span><input name="newSkillDescription" placeholder="One line: when an agent should load it" /></label>
      <label className="field"><span>Content</span><textarea name="newSkillContent" rows={10} spellCheck={false} placeholder={"## Checklist\n- …"} /></label>
      <p className="field-hint">Becomes SKILL.md in PowerLoom&apos;s skills folder; editable later on its page. <button type="button" className="link" onClick={() => setOpen(false)}>Skip</button></p>
    </fieldset>
  );
}
