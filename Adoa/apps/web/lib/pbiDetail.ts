import { agentRun, attachment, localItem, workItem } from "@adoa/db";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";

// Everything the PBI page shows; attachment bytes are left out (downloads read them on their own).
export async function loadPbiDetail(adoId: number) {
  const db = getDb();
  const [pbi] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi) {
    return null;
  }

  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId)).orderBy(localItem.id);
  const attachments = await db
    .select({
      id: attachment.id,
      itemId: attachment.itemId,
      sourceUrl: attachment.sourceUrl,
      fileName: attachment.fileName,
      sizeBytes: attachment.sizeBytes,
      textChars: sql<number | null>`length(${attachment.text})`,
      vaultPath: attachment.vaultPath,
      createdAt: attachment.createdAt,
    })
    .from(attachment)
    .where(eq(attachment.pbiId, adoId))
    .orderBy(attachment.id);
  const runs = await db.select().from(agentRun).where(eq(agentRun.pbiId, adoId)).orderBy(desc(agentRun.id));

  return { pbi, items, attachments, runs };
}

export type PbiDetail = NonNullable<Awaited<ReturnType<typeof loadPbiDetail>>>;
