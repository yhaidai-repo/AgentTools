import { sprintSnapshot, workItem, type AdoaDb } from "@adoa/db";
import { eq, sql } from "drizzle-orm";
import type { SprintRef } from "./models/SprintRef";

// One row per PBI per day for the current sprint; a later sync the same day overwrites it.
export async function snapshotCurrentSprint(db: AdoaDb, sprints: SprintRef[]): Promise<void> {
  const current = sprints.find((sprint) => sprint.timeframe === "current");

  if (!current) {
    return;
  }

  const rows = await db.select().from(workItem).where(eq(workItem.iterationPath, current.path));
  const takenOn = new Date().toISOString().slice(0, 10);
  const snapshots = rows.map((row) => ({
    iterationPath: current.path,
    takenOn,
    adoId: row.adoId,
    adoState: row.adoState,
    effort: row.effort,
    remainingWork: row.remainingWork,
  }));

  if (snapshots.length === 0) {
    return;
  }

  await db
    .insert(sprintSnapshot)
    .values(snapshots)
    .onConflictDoUpdate({
      target: [sprintSnapshot.iterationPath, sprintSnapshot.takenOn, sprintSnapshot.adoId],
      set: {
        adoState: sql`excluded.ado_state`,
        effort: sql`excluded.effort`,
        remainingWork: sql`excluded.remaining_work`,
      },
    });
}
