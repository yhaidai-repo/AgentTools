"use server";

import { restoreSkillCommand, saveSkillCommand, type Outcome, type SavedSkill } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";

// PowerLoom writes PowerLoom's own skills (user decision 2026-10-01) and keeps the replaced version as a revision;
// the page runs the same commands a chat uses.
export async function saveSkill(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const saved = await runWebCommand(saveSkillCommand, { name, content: String(form.get("content") ?? ""), hash: String(form.get("hash")) });

  return finish(name, saved, () => "Saved. Agents use it from their next run.");
}

// A restore is a save of the old content, so the version it replaces becomes a revision too.
export async function restoreRevision(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const restored = await runWebCommand(restoreSkillCommand, { name, revisionId: Number(form.get("revisionId")), hash: String(form.get("hash")) });

  return finish(name, restored, (skill) => (skill.restoredFrom ? `Restored the version from ${skill.restoredFrom.slice(0, 16).replace("T", " ")} UTC.` : "Restored."));
}

function finish(name: string, outcome: Outcome<SavedSkill>, done: (skill: SavedSkill) => string): ActionResult {
  if (!outcome.ok) {
    return { ok: false, message: outcome.error };
  }

  revalidatePath(`/skills/${name}`);

  return { ok: true, message: done(outcome.value) };
}
