import { localItem, refinement, workItem, type AdoaDb } from "@adoa/db";
import { escapeCell } from "./escapeCell";
import { desc, eq } from "drizzle-orm";
import { refinementNoteName } from "@adoa/vault";

type WorkItemRow = typeof workItem.$inferSelect;

// Content of the PBI note's generated regions, built from the DB so every render shows the current state.
export async function pipelineRegions(db: AdoaDb, row: WorkItemRow): Promise<Record<string, string>> {
  return {
    refinement: await refinementRegion(db, row.adoId),
    items: await itemsRegion(db, row.adoId),
  };
}

async function refinementRegion(db: AdoaDb, adoId: number): Promise<string> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  if (!latest) {
    return "Pending.";
  }

  return `${latest.summary}\n\nDetails: [[${refinementNoteName(adoId)}]] (v${latest.version})`;
}

async function itemsRegion(db: AdoaDb, adoId: number): Promise<string> {
  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId)).orderBy(localItem.id);

  if (items.length === 0) {
    return "None yet.";
  }

  const lines = items.map((item) => `| [[${item.id}]] | ${item.kind} | ${item.status} | ${escapeCell(item.title)} |`);

  return ["| Item | Kind | Status | Title |", "|---|---|---|---|", ...lines].join("\n");
}
