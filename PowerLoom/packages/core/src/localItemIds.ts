import type { PowerLoomDb } from "@powerloom/db";
import { sql } from "drizzle-orm";

// XT: a task of a custom type an agent made in the UI handles (user decision 2026-10-24).
export type ItemPrefix = "RT" | "AT" | "DT" | "HT" | "Q" | "RR" | "TT" | "TR" | "XT";

// Items that may have no PBI (tech-writer tasks, their findings, vault-review tasks) are numbered across the app: `WT-001`,
// `F-001`, `VR-001`.
export type GlobalItemPrefix = "WT" | "F" | "VR" | "GT" | "MT";

// Ids are `<prefix>-<adoId>-<nnn>`, numbered per PBI and prefix; never reused.
export async function nextItemId(db: PowerLoomDb, prefix: ItemPrefix, adoId: number): Promise<string> {
  return nextScopedItemId(db, `${prefix}-${adoId}-`);
}

export async function nextGlobalItemId(db: PowerLoomDb, prefix: GlobalItemPrefix): Promise<string> {
  return nextScopedItemId(db, `${prefix}-`);
}

// The next `<stem><nnn>` across all items, e.g. stem `CR-6322-` for the review tasks of pull request 6322.
export async function nextScopedItemId(db: PowerLoomDb, stem: string): Promise<string> {
  const result = await db.execute<{ id: string }>(sql`select reserve_item_id(${stem}) as id`);
  return result.rows[0].id;
}
