import { workItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import { workItemUrl } from "../adoLinks";
import type { PbiOverview } from "../models/PbiOverview";
import { pbiRepoNames } from "../pbiRepos";
import { readAdoSettings } from "../settings";
import { readBug } from "./bugRecords";
import { readChildItems, topLevelPbi } from "./childItems";

// What `pbi.get` answers: the PBI, where it sits (parent, children, bug record) and what its agents work with.
export async function readPbiOverview(db: AdoaDb, adoId: number): Promise<PbiOverview | null> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row) {
    return null;
  }

  const parent = row.parentId ? await topLevelPbi(db, row.adoId) : null;

  return {
    adoId: row.adoId,
    title: row.title,
    type: row.type,
    source: row.source,
    vault: row.vault,
    adoState: row.adoState,
    pipelineStatus: row.pipelineStatus,
    adoUrl: workItemUrl(await readAdoSettings(db, row.vault), row),
    notePath: row.vaultPath,
    descriptionMd: row.descriptionMd,
    acceptanceCriteriaMd: row.acceptanceCriteriaMd,
    parent: parent ? { adoId: parent.adoId, title: parent.title } : null,
    children: await readChildItems(db, row.adoId),
    bug: await readBug(db, row.adoId),
    repos: await pbiRepoNames(db, row.adoId),
    skills: row.skills.map((skill) => skill.name),
  };
}
