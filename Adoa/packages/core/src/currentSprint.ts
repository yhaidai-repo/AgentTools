import { config, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";

const CURRENT_SPRINT_KEY = "currentSprint";

// Written by sync (which knows ADO's current iteration), read by agents to take the current sprint first.
export async function saveCurrentSprint(db: AdoaDb, iterationPath: string): Promise<void> {
  await db
    .insert(config)
    .values({ key: CURRENT_SPRINT_KEY, value: iterationPath })
    .onConflictDoUpdate({ target: config.key, set: { value: iterationPath, updatedAt: new Date() } });
}

export async function readCurrentSprint(db: AdoaDb): Promise<string | null> {
  const [row] = await db.select().from(config).where(eq(config.key, CURRENT_SPRINT_KEY));

  return typeof row?.value === "string" ? row.value : null;
}
