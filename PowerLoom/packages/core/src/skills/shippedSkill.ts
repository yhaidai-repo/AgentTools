import { config, type PowerLoomDb } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";
import type { ShippedSkill } from "../models/ShippedSkill";

// Written by the API at start (ShippedSkillsRefresher), one entry per shipped skill.
export const SHIPPED_SKILLS_KEY = "skills:shipped";

// How the API's start last applied one shipped skill; null for a skill PowerLoom doesn't ship.
export async function loadShippedSkill(db: PowerLoomDb, name: string): Promise<ShippedSkill | null> {
  const [row] = await db
    .select({ entry: sql<ShippedSkill | null>`${config.value}->'skills'->${name}` })
    .from(config)
    .where(eq(config.key, SHIPPED_SKILLS_KEY));

  return row?.entry ?? null;
}
