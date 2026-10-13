import { attachment, design, localItem, refinement, testCase, vaultCapture, workItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { attachmentRef } from "../attachmentIds";
import type { Outcome } from "../models/Outcome";
import { buildPbiContext } from "./buildPbiContext";

const PBI_REF = /^PBI-(\d+)$/i;
const VERSIONED_REF = /^PBI-(\d+):(refinement|design)$/i;
const DRAFT_REF = /^DRAFT-(\d+)$/i;
const ATTACHMENT_REF = /^ATT-(\d+)$/i;
const TEST_CASE_REF = /^TC-(\d+)$/i;

// Any reference a PBI context lists, in full: a PBI (its own context), its latest refinement or design, an item
// (question, task, finding, result), a vault draft, an upload's text or an Azure DevOps test case.
export async function readPbiReference(db: PowerLoomDb, backlogMount: string, ref: string): Promise<Outcome<string>> {
  const versioned = VERSIONED_REF.exec(ref);
  const pbi = PBI_REF.exec(ref);
  const draft = DRAFT_REF.exec(ref);
  const upload = ATTACHMENT_REF.exec(ref);
  const test = TEST_CASE_REF.exec(ref);

  if (versioned) {
    return readVersioned(db, Number(versioned[1]), versioned[2].toLowerCase());
  }

  if (pbi) {
    return readPbi(db, backlogMount, Number(pbi[1]));
  }

  if (draft) {
    return readDraft(db, Number(draft[1]));
  }

  if (upload) {
    return readAttachment(db, Number(upload[1]));
  }

  if (test) {
    return readTestCase(db, Number(test[1]));
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

// The whole text: a chat reads it at once (agents page through long ones with read_attachment).
async function readAttachment(db: PowerLoomDb, id: number): Promise<Outcome<string>> {
  const [file] = await db.select({ fileName: attachment.fileName, text: attachment.text }).from(attachment).where(eq(attachment.id, id));

  if (!file) {
    return notFound(attachmentRef(id));
  }

  return { ok: true, value: file.text ?? `${attachmentRef(id)} (${file.fileName}) has no text: images can't be read yet.` };
}

// A case that tests several PBIs has a row per PBI; the latest read is shown, with every PBI it tests.
async function readTestCase(db: PowerLoomDb, adoId: number): Promise<Outcome<string>> {
  const rows = await db.select().from(testCase).where(eq(testCase.adoId, adoId)).orderBy(desc(testCase.fetchedAt));
  const [latest] = rows;

  if (!latest) {
    return notFound(`TC-${adoId}`);
  }

  const header = [
    `# TC-${adoId}: ${latest.title}`,
    `State: ${latest.state} · Priority: ${latest.priority ?? "-"} · ADO rev ${latest.rev} · read ${latest.fetchedAt.toISOString().slice(0, 10)}`,
    `Tests: ${rows.map((row) => `PBI-${row.pbiId}`).join(", ")}`,
  ];
  const parameters = latest.parameters ? ["## Parameters", latest.parameters] : [];

  return { ok: true, value: [...header, "## Steps", latest.stepsMd, ...parameters].join("\n\n") };
}

function asJson(value: unknown): Outcome<string> {
  return { ok: true, value: JSON.stringify(value, null, 2) };
}

function notFound(ref: string): Outcome<string> {
  return { ok: false, error: `Nothing found for ${ref}. Use a reference exactly as a PBI context lists it.` };
}
