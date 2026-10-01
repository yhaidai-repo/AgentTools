"use server";

import { skillRevision } from "@adoa/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { saveSkillContent } from "@/lib/skillEditing";
import type { ActionResult } from "@/models/ActionResult";

export async function saveSkill(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const saved = await saveSkillContent(name, String(form.get("content") ?? ""), String(form.get("hash")));

  return finish(name, saved.ok ? null : saved.error, "Saved. Agents use it from their next run.");
}

// A restore is a save of the old content, so the version it replaces becomes a revision too.
export async function restoreRevision(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const [revision] = await getDb().select().from(skillRevision).where(eq(skillRevision.id, Number(form.get("revisionId"))));

  if (!revision || revision.name !== name) {
    return { ok: false, message: "Unknown version." };
  }

  const saved = await saveSkillContent(name, revision.content, String(form.get("hash")));

  return finish(name, saved.ok ? null : saved.error, `Restored the version from ${revision.savedAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`);
}

function finish(name: string, error: string | null, message: string): ActionResult {
  if (error) {
    return { ok: false, message: error };
  }

  revalidatePath(`/skills/${name}`);

  return { ok: true, message };
}
