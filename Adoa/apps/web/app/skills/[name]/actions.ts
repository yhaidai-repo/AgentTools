"use server";

import { revalidatePath } from "next/cache";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// PowerLoom writes adoa's own skills (user decision 2026-10-01) and keeps the replaced version as a revision.
export async function saveSkill(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const saved = await powerloom.PUT("/api/skills/{name}", { params: { path: { name } }, body: { content: String(form.get("content") ?? ""), hash: String(form.get("hash")) } });

  return finish(name, powerloomResult(saved, "Saved. Agents use it from their next run."));
}

// A restore is a save of the old content, so the version it replaces becomes a revision too.
export async function restoreRevision(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name"));
  const restored = await powerloom.POST("/api/skills/{name}/revisions/{id}/restore", { params: { path: { name, id: Number(form.get("revisionId")) } }, body: { hash: String(form.get("hash")) } });
  const savedAt = restored.data?.restoredFrom ? `Restored the version from ${restored.data.restoredFrom.slice(0, 16).replace("T", " ")} UTC.` : "Restored.";

  return finish(name, powerloomResult(restored, savedAt));
}

function finish(name: string, result: ActionResult): ActionResult {
  if (result.ok) {
    revalidatePath(`/skills/${name}`);
  }

  return result;
}
