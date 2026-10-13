import { attachment, design, localItem, refinement, vaultCapture, workItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { attachmentRef } from "../attachmentIds";
import type { Outcome } from "../models/Outcome";
import { buildPbiContext } from "./buildPbiContext";

const PBI_REF = /^PBI-(\d+)$/i;
const VERSIONED_REF = /^PBI-(\d+):(refinement|design)$/i;
const DRAFT_REF = /^DRAFT-(\d+)$/i;

// Any reference a PBI context lists, in full: a PBI (its own context), its latest refinement or design, an item
// (question, task, finding, result) or a vault draft.
export async function readPbiReference(db: PowerLoomDb, backlogMount: string, ref: string): Promise<Outcome<string>> {
  const versioned = VERSIONED_REF.exec(ref);
  const pbi = PBI_REF.exec(ref);
  const draft = DRAFT_REF.exec(ref);

  if (versioned) {
    return readVersioned(db, Number(versioned[1]), versioned[2].toLowerCase());
  }

  if (pbi) {
    return readPbi(db, backlogMount, Number(pbi[1]));
  }

  if (draft) {
    return readDraft(db, Number(draft[1]));
  }

  return readItem(db, ref);
}

async function readPbi(db: PowerLoomDb, backlogMount: string, adoId: number): Promise<Outcome<string>> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  return row ? { ok: true, value: await buildPbiContext(db, backlogMount, row) } : notFound(`PBI-${adoId}`);
}

async function readVersioned(db: PowerLoomDb, adoId: number, kind: string): Promise<Outcome<string>> {
  const rows = kind === "design"
    ? await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1)
    : await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return rows.length > 0 ? asJson(rows[0]) : notFound(`PBI-${adoId}:${kind}`);
}

async function readItem(db: PowerLoomDb, id: string): Promise<Outcome<string>> {
  const [item] = await db.select().from(localItem).where(eq(localItem.id, id));

  if (!item) {
    return notFound(id);
  }

  const files = await db.select({ id: attachment.id, fileName: attachment.fileName }).from(attachment).where(eq(attachment.itemId, id));
  const { id: itemId, kind, status, title, body, resolution, data, parentId, pbiId, createdAt, closedAt } = item;

  return asJson({ id: itemId, kind, status, title, body, resolution, data, parentId, pbiId, createdAt, closedAt, attachments: files.map((file) => `${attachmentRef(file.id)} ${file.fileName}`) });
}

async function readDraft(db: PowerLoomDb, id: number): Promise<Outcome<string>> {
  const [draft] = await db.select().from(vaultCapture).where(eq(vaultCapture.id, id));

  return draft ? asJson(draft) : notFound(`DRAFT-${id}`);
}

function asJson(value: unknown): Outcome<string> {
  return { ok: true, value: JSON.stringify(value, null, 2) };
}

function notFound(ref: string): Outcome<string> {
  return { ok: false, error: `Nothing found for ${ref}. Use a reference exactly as a PBI context lists it.` };
}
