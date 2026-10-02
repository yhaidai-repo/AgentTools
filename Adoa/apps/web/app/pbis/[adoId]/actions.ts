"use server";

import { CONFLUENCE_QUEUE, addPbiConfluencePages, confluencePageProblem, pageTitleFromUrl, pbiSkillProblems, removePbiConfluencePage, savePbiRepos, savePbiSkills, type ConfluenceFetchJob } from "@adoa/core";
import { storeAttachment } from "@adoa/attachments";
import { workItem, type PbiSkill } from "@adoa/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { afterItemChange } from "@/lib/afterItemChange";
import { getBoss } from "@/lib/boss";
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

// "Load from Confluence" for a linked page whose content is missing: the worker holds the token, so it fetches the page;
// it also closes the task asking for the content, and a failure becomes (or stays) that task with the reason.
export async function loadFromConfluence(adoId: number, url: string): Promise<ActionResult> {
  const problem = confluencePageProblem(url);

  if (problem) {
    return { ok: false, message: problem };
  }

  const job: ConfluenceFetchJob = { adoId, url };

  await (await getBoss()).send(CONFLUENCE_QUEUE, job);

  return { ok: true, message: "Loading from Confluence; reload in a few seconds." };
}

// A Confluence page added to the PBI's attachments as a link (user decision 2026-10-02): listed for the later agents with
// why, opened by agents with the Confluence tools; not fetched. A page already listed keeps its entry.
export async function addConfluenceLink(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const url = formText(form, "url") ?? "";
  const problem = confluencePageProblem(url);

  if (problem) {
    return { ok: false, message: problem };
  }

  await addPbiConfluencePages(getDb(), adoId, [{ url, title: pageTitleFromUrl(url), why: formText(form, "why") ?? "", by: "user" }]);
  revalidatePath(`/pbis/${adoId}`);

  return { ok: true, message: "Link added. Later agents on this PBI get it with why." };
}

export async function removeConfluenceLink(adoId: number, url: string): Promise<void> {
  await removePbiConfluencePage(getDb(), adoId, url);
  revalidatePath(`/pbis/${adoId}`);
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
