import { readCurrentSprint } from "@powerloom/core";
import { sprintSnapshot } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { SPRINT_RANGE, fixedPeriodStart, weekStart } from "./ranges";

// When the period starts for the vault. The current sprint starts on its first daily snapshot: the sync stores only the
// sprint's name, and it snapshots the sprint every day it runs. Without a snapshot yet, the week stands in.
export async function periodStart(range: string, vault: string): Promise<Date> {
  const now = new Date();

  if (range !== SPRINT_RANGE) {
    return fixedPeriodStart(range, now);
  }

  return (await currentSprintStart(vault)) ?? weekStart(now);
}

async function currentSprintStart(vault: string): Promise<Date | null> {
  const db = getDb();
  const path = await readCurrentSprint(db, vault);

  if (!path) {
    return null;
  }

  const [row] = await db.select({ firstDay: sql<string | null>`min(${sprintSnapshot.takenOn})` }).from(sprintSnapshot).where(eq(sprintSnapshot.iterationPath, path));

  return row?.firstDay ? new Date(`${row.firstDay}T00:00:00Z`) : null;
}
