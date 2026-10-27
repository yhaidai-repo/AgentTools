import { workItemUrl, type AdoSettings, type PipelineStatus } from "@powerloom/core";
import { workItem, type PowerLoomDb } from "@powerloom/db";
import {
  BACKLOG_INDEX_PATH,
  DEFAULT_PBI_TEMPLATE,
  PBI_TEMPLATE_PATH,
  VaultWriter,
  pbiNotePath,
  renderBacklogIndex,
  renderPreparedPbi,
  type PbiNote,
} from "@powerloom/vault";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { writeAttachmentFiles } from "./attachments";
import { pipelineRegions } from "./pipelineRegions";

type WorkItemRow = typeof workItem.$inferSelect;

// Shared by prepare and publishPbi, so a PBI note always looks the same whichever process wrote it.
export class PbiNoteWriter {
  private constructor(
    readonly writer: VaultWriter,
    private readonly db: PowerLoomDb,
    private readonly vault: string,
    private readonly ado: AdoSettings | null,
    private readonly template: string,
  ) {}

  static async create(db: PowerLoomDb, ado: AdoSettings | null, vaultRoot: string, vault: string): Promise<PbiNoteWriter> {
    const writer = new VaultWriter(vaultRoot);
    const template = await writer.readOrCreate(PBI_TEMPLATE_PATH, DEFAULT_PBI_TEMPLATE);

    return new PbiNoteWriter(writer, db, vault, ado, template);
  }

  // Writes the note and the PBI's uploads, stores the note's path; returns the path.
  async writePbi(row: WorkItemRow, status: PipelineStatus): Promise<string> {
    if (row.vault !== this.vault) throw new Error("PBI does not belong to the note writer's vault");
    const vaultPath = row.vaultPath ?? pbiNotePath(row.adoId, row.title);
    const note = toPbiNote(row, status, this.ado);
    const regions = await pipelineRegions(this.db, row);

    await this.writer.write(vaultPath, (notes) => renderPreparedPbi(this.template, note, notes, regions));
    await this.db.update(workItem).set({ vaultPath }).where(eq(workItem.adoId, row.adoId));
    await writeAttachmentFiles(this.db, this.writer, vaultPath, row.adoId);

    return vaultPath;
  }

  async writeIndex(): Promise<void> {
    const rows = await this.db.select().from(workItem).where(and(eq(workItem.vault, this.vault), isNotNull(workItem.vaultPath))).orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));

    await this.writer.write(BACKLOG_INDEX_PATH, (notes) => renderBacklogIndex(rows, notes));
  }
}

function toPbiNote(row: WorkItemRow, status: PipelineStatus, ado: AdoSettings | null): PbiNote {
  return {
    adoId: row.adoId,
    title: row.title,
    type: row.type,
    adoState: row.adoState,
    adoUrl: workItemUrl(ado, row) ?? "",
    pipelineStatus: status,
    iterationPath: row.iterationPath,
    areaPath: row.areaPath,
    assignedTo: row.assignedTo,
    priority: row.priority,
    tags: row.tags ? row.tags.split(";").map((tag) => tag.trim()) : [],
    descriptionMd: row.descriptionMd,
    acceptanceCriteriaMd: row.acceptanceCriteriaMd,
    parentId: row.parentId,
    created: row.createdAt,
    updated: row.adoChangedAt ?? row.syncedAt,
  };
}
