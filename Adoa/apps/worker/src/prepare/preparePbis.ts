import { readAdoSettings, setPbiStatus, workItemUrl, type AdoSettings, type PipelineStatus } from "@adoa/core";
import { workItem, type AdoaDb } from "@adoa/db";
import {
  BACKLOG_INDEX_PATH,
  DEFAULT_PBI_TEMPLATE,
  PBI_TEMPLATE_PATH,
  VaultWriter,
  pbiNotePath,
  renderBacklogIndex,
  renderPreparedPbi,
  type PbiNote,
} from "@adoa/vault";
import { asc, eq, isNotNull } from "drizzle-orm";
import { vaultRoot } from "../env";

type WorkItemRow = typeof workItem.$inferSelect;

const PREPARABLE: PipelineStatus[] = ["new", "stale"];

// Manual step (user selects PBIs): creates the note from the Vault template and hands the PBI to refinement.
export async function preparePbis(db: AdoaDb, adoIds: number[]): Promise<number> {
  const ado = await readAdoSettings(db);

  if (!ado) {
    throw new Error("ADO settings are not configured");
  }

  const writer = new VaultWriter(vaultRoot());
  const template = await writer.readOrCreate(PBI_TEMPLATE_PATH, DEFAULT_PBI_TEMPLATE);
  let prepared = 0;

  for (const adoId of adoIds) {
    const isPrepared = await prepareOne(db, writer, template, ado, adoId);

    prepared += isPrepared ? 1 : 0;
  }

  await renderIndex(db, writer);

  return prepared;
}

async function prepareOne(db: AdoaDb, writer: VaultWriter, template: string, ado: AdoSettings, adoId: number): Promise<boolean> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row) {
    return false;
  }

  const status = PREPARABLE.includes(row.pipelineStatus) ? "ready-for-refinement" : row.pipelineStatus;
  const vaultPath = row.vaultPath ?? pbiNotePath(row.adoId, row.title);

  await writer.write(vaultPath, (notes) => renderPreparedPbi(template, toPbiNote(row, status, ado), notes));
  await db.update(workItem).set({ vaultPath }).where(eq(workItem.adoId, adoId));

  if (status !== row.pipelineStatus) {
    await setPbiStatus(db, adoId, row.pipelineStatus, status, "human");
  }

  return true;
}

async function renderIndex(db: AdoaDb, writer: VaultWriter): Promise<void> {
  const rows = await db.select().from(workItem).where(isNotNull(workItem.vaultPath)).orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));

  await writer.write(BACKLOG_INDEX_PATH, (notes) => renderBacklogIndex(rows, notes));
}

function toPbiNote(row: WorkItemRow, status: PipelineStatus, ado: AdoSettings): PbiNote {
  return {
    adoId: row.adoId,
    title: row.title,
    type: row.type,
    adoState: row.adoState,
    adoUrl: workItemUrl(ado, row.adoId),
    pipelineStatus: status,
    iterationPath: row.iterationPath,
    areaPath: row.areaPath,
    assignedTo: row.assignedTo,
    priority: row.priority,
    tags: row.tags ? row.tags.split(";").map((tag) => tag.trim()) : [],
    descriptionMd: row.descriptionMd,
    acceptanceCriteriaMd: row.acceptanceCriteriaMd,
    created: row.createdAt,
    updated: row.adoChangedAt ?? row.syncedAt,
  };
}
