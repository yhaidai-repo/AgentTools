import { localItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";

/** An item's kind (for a task, its task type) from the database; undefined when there is no such item. */
export async function itemKindOf(db: PowerLoomDb, itemId: string): Promise<string | undefined> {
  const [item] = await db.select({ kind: localItem.kind }).from(localItem).where(eq(localItem.id, itemId)).limit(1);

  return item?.kind;
}
