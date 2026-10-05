"use server";

import { applyTaskSchedule, createScheduledTask, deleteTaskSchedule, readTaskSchedule, removeTaskSchedule, saveTaskSchedule, type TaskSchedule, type TaskScheduleInput } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAgentConfig } from "@/lib/agentConfig";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import { readParams } from "@/lib/scheduleParams";
import type { ActionResult } from "@/models/ActionResult";

// Saved first (a new schedule needs its id for the pg-boss key), then scheduled; a cron pg-boss refuses undoes the save.
export async function saveScheduleAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const input = readScheduleForm(form);
  const previous = input.id === null ? null : await readTaskSchedule(getDb(), input.id);
  const saved = await saveTaskSchedule(getDb(), input);

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  try {
    await applyTaskSchedule(await getBoss(), saved.value);
  } catch (error) {
    await undoSave(previous, saved.value);

    return { ok: false, message: `Schedule not saved: ${error instanceof Error ? error.message : String(error)}` };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

// A regular task right away (user decision 2026-10-03), even when a scheduled tick would find nothing to do; it shows in
// the task list, and what happened in the schedule's Last tick. Run here, not in the worker, so the page shows it at once.
export async function createNowAction(form: FormData): Promise<void> {
  const schedule = await readTaskSchedule(getDb(), Number(form.get("id")));

  if (schedule) {
    const agent = await getAgentConfig().get(schedule.agentId);

    await createScheduledTask(getDb(), schedule, agent?.options ?? {}, true);
  }

  revalidatePath("/tasks");
}

export async function deleteScheduleAction(form: FormData): Promise<void> {
  const id = Number(form.get("id"));

  await removeTaskSchedule(await getBoss(), id);
  await deleteTaskSchedule(getDb(), id);
  revalidatePath("/tasks");
}

function readScheduleForm(form: FormData): TaskScheduleInput {
  const id = formText(form, "id");

  return {
    id: id === null ? null : Number(id),
    name: formText(form, "name") ?? "",
    agentId: formText(form, "agentId") ?? "",
    cron: formText(form, "cron") ?? "",
    enabled: form.get("enabled") === "on",
    params: readParams(form),
  };
}

async function undoSave(previous: TaskSchedule | null, saved: TaskSchedule): Promise<void> {
  if (!previous) {
    await deleteTaskSchedule(getDb(), saved.id);

    return;
  }

  await saveTaskSchedule(getDb(), { id: previous.id, name: previous.name, agentId: previous.agentId, cron: previous.cron, enabled: previous.enabled, params: previous.params });
}
