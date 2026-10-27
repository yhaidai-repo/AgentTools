"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveSkill } from "./actions";
import { KeptForm } from "@/components/KeptForm";
import { EditorConflictNotice } from "@/components/EditorConflictNotice";
import { useVersionedEditor } from "@/lib/useVersionedEditor";

// The whole SKILL.md, frontmatter included; `hash` is what the page loaded, so a save over someone else's change is refused.
export function SkillEditor({ name, content, hash }: { name: string; content: string; hash: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveSkill, null);
  const editor = useVersionedEditor(name, content, hash);

  return (
    <KeptForm action={action} className="close-item">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="hash" value={editor.baseline} />
      <textarea name="content" rows={Math.min(40, Math.max(12, editor.text.split("\n").length + 2))} value={editor.text} onChange={event => editor.edit(event.target.value)} className="skill-editor" spellCheck={false} />
      <EditorConflictNotice conflict={editor.conflict} loadLatest={editor.loadLatest} />
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save skill"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}
