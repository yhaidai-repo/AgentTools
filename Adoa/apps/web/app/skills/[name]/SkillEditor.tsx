"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveSkill } from "./actions";

// The whole SKILL.md, frontmatter included; `hash` is what the page loaded, so a save over someone else's change is refused.
export function SkillEditor({ name, content, hash }: { name: string; content: string; hash: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveSkill, null);

  return (
    <form action={action} className="close-item">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="hash" value={hash} />
      <textarea name="content" rows={Math.min(40, Math.max(12, content.split("\n").length + 2))} defaultValue={content} className="skill-editor" spellCheck={false} />
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save skill"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </form>
  );
}
