"use server";

import { pbiSkillProblems, savePbiRepos, savePbiSkills } from "@adoa/core";
import { storeAttachment } from "@adoa/attachments";
import { workItem, type PbiSkill } from "@adoa/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { afterItemChange } from "@/lib/afterItemChange";
import { getDb } from "@/lib/db";
import { formText, readUpload } from "@/lib/formFields";
import { loadSkillCatalog } from "@/lib/skills";
import type { ActionResult } from "@/models/ActionResult";

export async function addAttachment(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const file = await readUpload(form);

  if (!file) {
    return { ok: false, message: "Choose a file." };
  }

  const stored = await storeAttachment(getDb(), file, { adoId, itemId: null, sourceUrl: null });

  if (!stored.ok) {
    return { ok: false, message: stored.error };
  }

  await afterItemChange(adoId);

  return { ok: true, message: `Uploaded as ATT-${stored.value}.` };
}

// The user's repo list (user decision 2026-10-02); answers refinement's open repo question too.
export async function saveRepos(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const saved = await savePbiRepos(getDb(), adoId, form.getAll("repo").map(String));

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  await afterItemChange(adoId);

  return { ok: true, message: `Saved ${saved.value} repo(s). Research and design clone these.` };
}

// The user's list for the PBI's later agents; from now on refinement leaves it. Skills kept from the list keep who added them.
export async function saveSkills(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const names = form.getAll("skill").map(String);
  const problems = pbiSkillProblems(names, (await loadSkillCatalog()).skills.map((skill) => skill.name));

  if (problems.length > 0) {
    return { ok: false, message: `Not saved: ${problems.join("; ")}.` };
  }

  const [pbi] = await getDb().select({ skills: workItem.skills }).from(workItem).where(eq(workItem.adoId, adoId));
  const skills: PbiSkill[] = names.map((name) => ({ name, reason: formText(form, `reason:${name}`) ?? "", by: pbi?.skills.find((skill) => skill.name === name)?.by ?? "user" }));

  await savePbiSkills(getDb(), adoId, skills);
  revalidatePath(`/pbis/${adoId}`);

  return { ok: true, message: `Saved ${skills.length} skill(s). The next agent runs on this PBI load them.` };
}
