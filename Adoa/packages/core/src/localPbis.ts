import { localPbiId, workItem, type AdoaDb } from "@adoa/db";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { NewPbi } from "./models/NewPbi";
import { setPbiStatus } from "./pbiStatus";

const LOCAL_STATE = "New";

// A local PBI: numbered from its own sequence (above every ADO id), state New, pipeline new like a synced one; the user
// prepares it for refinement as usual.
export async function createLocalPbi(db: AdoaDb, actor: string, input: NewPbi): Promise<number> {
  const [row] = await db
    .insert(workItem)
    .values({
      adoId: sql`nextval(${sql.raw(`'${localPbiId.seqName}'`)})`,
      vault: input.vault,
      source: "local",
      type: input.type,
      title: input.title,
      adoState: LOCAL_STATE,
      priority: input.priority,
      rev: 0,
      contentHash: hashContent(input),
      descriptionMd: input.descriptionMd,
      acceptanceCriteriaMd: input.acceptanceCriteriaMd,
      pipelineStatus: "new",
    })
    .returning({ adoId: workItem.adoId });

  await setPbiStatus(db, row.adoId, null, "new", actor);

  return row.adoId;
}

function hashContent(input: NewPbi): string {
  return createHash("sha256").update([input.title, input.descriptionMd ?? "", input.acceptanceCriteriaMd ?? ""].join("\n")).digest("hex");
}
