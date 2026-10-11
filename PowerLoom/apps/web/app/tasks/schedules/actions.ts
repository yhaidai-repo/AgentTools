"use server";

import { readTaskSchedule, type TaskScheduleInput } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// PowerLoom saves the schedule and ticks it from the saved cron: nothing to apply here.
export async function saveScheduleAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const previous = formText(form, "id") === null ? null : await readTaskSchedule(getDb(), Number(formText(form, "id")));
  // A schedule keeps its vault; a new one maintains the vault selected in the top bar (user decision 2026-10-05).
  const input = readScheduleForm(form, previous?.vault ?? (await requireVault()));
  const saved = await powerloom.PUT("/api/task-schedules", {
    body: { id: input.id, name: input.name, agentId: input.agentId, vault: input.vault, cron: input.cron, enabled: input.enabled, goal: String(input.params.goal ?? ""), repos: input.params.repos as string[] },
  });

  if (!saved.response.ok) {
    return powerloomResult(saved, "");
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

// A regular task right away (user decision 2026-10-03), even when a scheduled tick would find nothing to do; it shows in
// the task list, and what happened in the schedule's Last tick.
export async function createNowAction(form: FormData): Promise<void> {
  await powerloom.POST("/api/task-schedules/{id}/tick", { params: { path: { id: Number(form.get("id")) } } });
  revalidatePath("/tasks");
}

export async function deleteScheduleAction(form: FormData): Promise<void> {
  await powerloom.DELETE("/api/task-schedules/{id}", { params: { path: { id: Number(form.get("id")) } } });
  revalidatePath("/tasks");
}

function readScheduleForm(form: FormData, vault: string): TaskScheduleInput {
  const id = formText(form, "id");

  return {
    id: id === null ? null : Number(id),
    name: formText(form, "name") ?? "",
    agentId: formText(form, "agentId") ?? "",
    vault,
    cron: formText(form, "cron") ?? "",
    enabled: form.get("enabled") === "on",
    params: { goal: formText(form, "goal") ?? "", repos: form.getAll("repos").map(String).filter(Boolean) },
  };
}
