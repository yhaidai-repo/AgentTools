"use server";

import { revalidatePath } from "next/cache";
import { powerloom } from "@/lib/powerloom";

// A regular task right away (user decision 2026-10-03), unless one of the schedule's tasks still waits; it shows in the
// task list, and what happened in the schedule's Last tick.
export async function createNowAction(form: FormData): Promise<void> {
  await powerloom.POST("/api/task-schedules/{id}/tick", { params: { path: { id: Number(form.get("id")) } } });
  revalidatePath("/tasks");
}

export async function deleteScheduleAction(form: FormData): Promise<void> {
  await powerloom.DELETE("/api/task-schedules/{id}", { params: { path: { id: Number(form.get("id")) } } });
  revalidatePath("/tasks");
}
