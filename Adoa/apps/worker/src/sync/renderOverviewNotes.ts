import { workItem } from "@adoa/db";
import { BACKLOG_INDEX_PATH, renderBacklogIndex, renderSprintNote, sprintNotePath, type SprintNoteRow } from "@adoa/vault";
import { asc, eq } from "drizzle-orm";
import type { SprintRef } from "./models/SprintRef";
import type { SyncContext } from "./models/SyncContext";

export async function renderSprintNotes(ctx: SyncContext, sprints: SprintRef[]): Promise<void> {
  for (const sprint of sprints) {
    const rows = await loadSprintRows(ctx, sprint.path);

    await ctx.writer.write(sprintNotePath(sprint.path), (notes) => renderSprintNote({ ...sprint, iterationPath: sprint.path, rows }, notes));
  }
}

export async function renderIndexNote(ctx: SyncContext, sprints: SprintRef[]): Promise<void> {
  const rows = await ctx.db.select().from(workItem).orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));
  const sprintPaths = sprints.map((sprint) => sprint.path);

  await ctx.writer.write(BACKLOG_INDEX_PATH, (notes) => renderBacklogIndex(rows, sprintPaths, notes));
}

async function loadSprintRows(ctx: SyncContext, iterationPath: string): Promise<SprintNoteRow[]> {
  const rows = await ctx.db
    .select()
    .from(workItem)
    .where(eq(workItem.iterationPath, iterationPath))
    .orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));

  return rows.map((row) => ({
    adoId: row.adoId,
    title: row.title,
    adoState: row.adoState,
    pipelineStatus: row.pipelineStatus,
    effort: row.effort === null ? null : Number(row.effort),
  }));
}
