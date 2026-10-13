import { attachment, design, localItem, refinement, vaultCapture, workItem, type PowerLoomDb } from "@powerloom/db";
import { attachmentRef } from "@powerloom/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { buildPbiContext } from "./buildPbiContext";

const PBI_REF = /^PBI-(\d+)$/i;
const VERSIONED_REF = /^PBI-(\d+):(refinement|design)$/i;
const DRAFT_REF = /^DRAFT-(\d+)$/i;

type ToolText = { text: string; isError?: boolean };

// read_pbi: any reference a PBI context lists, in full. A PBI (its own context), its latest refinement or design, an
// item (question, task, finding, result) or a vault draft.
export function createReadPbiTool(db: PowerLoomDb, vaultRoot: string): ToolDefinition<any> {
  return defineTool({
    name: "read_pbi",
    description: "Read in full anything a PBI context lists by reference: PBI-<id> (another PBI, e.g. the parent or a child), PBI-<id>:refinement, PBI-<id>:design, an item id (e.g. Q-123-001, AT-123-002, a finding or result), or DRAFT-<n>.",
    input: { ref: z.string().describe("The reference as listed, e.g. PBI-123:design") },
    handler: async (input) => readReference(db, vaultRoot, input.ref.trim()),
  });
}

async function readReference(db: PowerLoomDb, vaultRoot: string, ref: string): Promise<ToolText> {
  const versioned = VERSIONED_REF.exec(ref);
  const pbi = PBI_REF.exec(ref);
  const draft = DRAFT_REF.exec(ref);

  if (versioned) {
    return readVersioned(db, Number(versioned[1]), versioned[2].toLowerCase());
  }

  if (pbi) {
    return readPbi(db, vaultRoot, Number(pbi[1]));
  }

  if (draft) {
    return readDraft(db, Number(draft[1]));
  }

  return readItem(db, ref);
}

async function readPbi(db: PowerLoomDb, vaultRoot: string, adoId: number): Promise<ToolText> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  return row ? { text: await buildPbiContext(db, vaultRoot, row) } : notFound(`PBI-${adoId}`);
}

async function readVersioned(db: PowerLoomDb, adoId: number, kind: string): Promise<ToolText> {
  const rows = kind === "design"
    ? await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1)
    : await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return rows.length > 0 ? asJson(rows[0]) : notFound(`PBI-${adoId}:${kind}`);
}

async function readItem(db: PowerLoomDb, id: string): Promise<ToolText> {
  const [item] = await db.select().from(localItem).where(eq(localItem.id, id));

  if (!item) {
    return notFound(id);
  }

  const files = await db.select({ id: attachment.id, fileName: attachment.fileName }).from(attachment).where(eq(attachment.itemId, id));
  const { id: itemId, kind, status, title, body, resolution, data, parentId, pbiId, createdAt, closedAt } = item;

  return asJson({ id: itemId, kind, status, title, body, resolution, data, parentId, pbiId, createdAt, closedAt, attachments: files.map((file) => `${attachmentRef(file.id)} ${file.fileName}`) });
}

async function readDraft(db: PowerLoomDb, id: number): Promise<ToolText> {
  const [draft] = await db.select().from(vaultCapture).where(eq(vaultCapture.id, id));

  return draft ? asJson(draft) : notFound(`DRAFT-${id}`);
}

function asJson(value: unknown): ToolText {
  return { text: JSON.stringify(value, null, 2) };
}

function notFound(ref: string): ToolText {
  return { text: `Nothing found for ${ref}. Use a reference exactly as a PBI context lists it.`, isError: true };
}
