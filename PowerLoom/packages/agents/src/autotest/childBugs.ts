import { isMarkedBug } from "@powerloom/core";
import { workItem, type PowerLoomDb } from "@powerloom/db";
import { asc, eq } from "drizzle-orm";
import type { ChildBug } from "./models/ChildBug";

// A removed bug was withdrawn, not fixed: nothing to retest.
const WITHDRAWN_STATE = "Removed";

// The PBI's bugs to retest: every [BUG] child except a withdrawn one. A done bug is retested too, since "done" is the
// developer's claim that it is fixed, which is what the retest proves.
export async function loadChildBugs(db: PowerLoomDb, pbiId: number): Promise<ChildBug[]> {
  const rows = await db
    .select({ adoId: workItem.adoId, title: workItem.title, type: workItem.type, adoState: workItem.adoState, steps: workItem.descriptionMd })
    .from(workItem)
    .where(eq(workItem.parentId, pbiId))
    .orderBy(asc(workItem.adoId));

  return rows.filter(isRetestable).map(({ adoId, title, adoState, steps }) => ({ adoId, title, adoState, steps }));
}

function isRetestable(row: { type: string; title: string; adoState: string }): boolean {
  return isMarkedBug(row.type, row.title) && row.adoState !== WITHDRAWN_STATE;
}
