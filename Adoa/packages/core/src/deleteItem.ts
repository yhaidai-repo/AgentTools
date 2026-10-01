import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";
import { itemOfPbi, pbiLabel } from "./itemScope";
import { setItemStatus } from "./pbiStatus";

// Questions and tasks the user may delete; results and refinements are agent output, not work items.
const DELETABLE_KINDS = ["question", "human", "finding", "research", "refinement", "design", "docs"];

// Whether the user may delete it now (the pages show the button only then).
export function isDeletableItem(item: { kind: string; status: string }): boolean {
  return DELETABLE_KINDS.includes(item.kind) && item.status !== "in-progress" && item.status !== "deleted";
}

// Soft delete (user decision 2026-10-01): the item disappears from the pages, notes and blockers, but stays in the DB
// so no agent creates it again and the history stays complete. A task an agent is working on can't be deleted.
export async function deleteItem(db: AdoaDb, adoId: number | null, itemId: string): Promise<Outcome<string>> {
  const [item] = await db.select().from(localItem).where(and(eq(localItem.id, itemId), itemOfPbi(adoId)));

  if (!item || !DELETABLE_KINDS.includes(item.kind)) {
    return { ok: false, error: `${itemId} is not a question or task of ${pbiLabel(adoId)}.` };
  }

  if (item.status === "deleted") {
    return { ok: false, error: `${itemId} is already deleted.` };
  }

  if (item.status === "in-progress") {
    return { ok: false, error: `${itemId} is being worked on by an agent; try again when the run has ended.` };
  }

  await setItemStatus(db, item.id, item.status, "deleted", "human");

  return { ok: true, value: item.id };
}
