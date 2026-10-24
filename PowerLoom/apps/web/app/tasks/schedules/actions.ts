"use server";

import { deleteScheduleCommand, tickScheduleCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";

// A regular task right away (user decision 2026-10-03), unless one of the schedule's tasks still waits; it shows in the
// task list, and what happened in the schedule's Last tick.
export async function createNowAction(form: FormData): Promise<void> {
  await runWebCommand(tickScheduleCommand, { id: Number(form.get("id")) });
  revalidatePath("/tasks");
}

export async function deleteScheduleAction(form: FormData): Promise<void> {
  await runWebCommand(deleteScheduleCommand, { id: Number(form.get("id")) });
  revalidatePath("/tasks");
}
