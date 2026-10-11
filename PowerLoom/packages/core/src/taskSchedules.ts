import { taskSchedule, type PowerLoomDb } from "@powerloom/db";
import { asc, eq } from "drizzle-orm";
import type { TaskSchedule } from "./models/TaskSchedule";

// Scheduled tasks are saved and ticked by PowerLoom (2026-10-11); the pages read them here.

export async function listTaskSchedules(db: PowerLoomDb): Promise<TaskSchedule[]> {
  return db.select().from(taskSchedule).orderBy(asc(taskSchedule.name), asc(taskSchedule.id));
}

// The selected vault's schedules (the Tasks page and the Maintenance tab show one vault, 2026-10-06).
export async function listVaultTaskSchedules(db: PowerLoomDb, vault: string): Promise<TaskSchedule[]> {
  return db.select().from(taskSchedule).where(eq(taskSchedule.vault, vault)).orderBy(asc(taskSchedule.name), asc(taskSchedule.id));
}

export async function readTaskSchedule(db: PowerLoomDb, id: number): Promise<TaskSchedule | null> {
  const [row] = await db.select().from(taskSchedule).where(eq(taskSchedule.id, id));

  return row ?? null;
}
