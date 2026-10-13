"use server";

import { readTaskSchedule } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import { itemPath } from "@/lib/items";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// One task now, or with a cron a schedule by task type (user decision 2026-10-14). PowerLoom checks the task against its
// type (PBI, note, repos) either way.
export async function saveTaskAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return formText(form, "cron") === null ? createTask(form) : saveSchedule(form);
}

// The new task's page opens.
async function createTask(form: FormData): Promise<ActionResult> {
  const created = await powerloom.POST("/api/tasks", { body: { ...readTask(form), vault: await requireVault(), actor: null } });

  if (!created.response.ok || !created.data) {
    return powerloomResult(created, "");
  }

  revalidatePath("/tasks");
  redirect(itemPath({ id: created.data.id, pbiId: created.data.pbiId ?? null }));
}

// A schedule keeps its vault; a new one belongs to the vault selected in the top bar.
async function saveSchedule(form: FormData): Promise<ActionResult> {
  const id = formText(form, "scheduleId") === null ? null : Number(formText(form, "scheduleId"));
  const previous = id === null ? null : await readTaskSchedule(getDb(), id);
  const task = readTask(form);
  const saved = await powerloom.PUT("/api/task-schedules", {
    body: { id, name: task.title, agentId: "", vault: previous?.vault ?? (await requireVault()), cron: formText(form, "cron") ?? "", enabled: form.get("enabled") === "on", goal: null, repos: task.repos, taskType: task.type, description: task.description, acceptanceCriteria: task.acceptanceCriteria, pbi: task.pbi, docPath: task.docPath },
  });

  if (!saved.response.ok) {
    return powerloomResult(saved, "");
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

function readTask(form: FormData) {
  return {
    type: formText(form, "type") ?? "",
    title: formText(form, "title") ?? "",
    description: formText(form, "description") ?? "",
    acceptanceCriteria: formText(form, "acceptanceCriteria") ?? "",
    pbi: formText(form, "pbi"),
    repos: form.getAll("repos").map(String).filter(Boolean),
    docPath: formText(form, "docPath"),
  };
}
