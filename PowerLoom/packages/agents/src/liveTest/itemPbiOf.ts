import { localItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { ItemPbiLookup } from "./models/ItemPbiLookup";

/** An item's PBI from the database: the guard's check that an item belongs to a PBI the run created. */
export function itemPbiOf(db: PowerLoomDb): ItemPbiLookup {
  return async (itemId) => {
    const [item] = await db.select({ pbiId: localItem.pbiId }).from(localItem).where(eq(localItem.id, itemId)).limit(1);

    return item?.pbiId;
  };
}
