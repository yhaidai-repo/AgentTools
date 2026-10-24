import { parseAttachmentRef } from "@powerloom/core";
import { attachment, type PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition, type ToolResult } from "@agenttools/runtime";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PAGE_CHARS, textPage } from "./textPages";

const attachmentInput = {
  id: z.string().describe("Attachment id, e.g. ATT-3"),
  offset: z.number().int().min(0).default(0).describe("Character offset; use the one the previous page gave"),
};

// read_attachment: the text of the PBI's uploads (converted on upload), in pages so a long document can't flood the context.
export function createAttachmentTool(db: PowerLoomDb, adoId: number): ToolDefinition<any> {
  return defineTool({
    name: "read_attachment",
    description: `Read a file the user uploaded for this PBI (listed in <attachments>), as text, ${PAGE_CHARS} characters per call.`,
    input: attachmentInput,
    handler: (input) => readAttachment(db, adoId, input.id, input.offset),
  });
}

// The chat's variant: no task names the PBI, so the call does (stage 2 of the powerloom-mcp design, 2026-10-23).
export function createChatAttachmentTool(db: PowerLoomDb): ToolDefinition<any> {
  return defineTool({
    name: "read_attachment",
    description: `Read a file the user uploaded for a PBI (pbi_read lists them as ATT-<n>), as text, ${PAGE_CHARS} characters per call.`,
    input: { pbiId: z.number().int().positive().describe("The PBI's id, e.g. 38519"), ...attachmentInput },
    annotations: { readOnly: true },
    handler: (input) => readAttachment(db, input.pbiId, input.id, input.offset),
  });
}

async function readAttachment(db: PowerLoomDb, adoId: number, ref: string, offset: number): Promise<ToolResult> {
  const id = parseAttachmentRef(ref);
  const [row] = id === null ? [] : await db.select({ text: attachment.text, fileName: attachment.fileName }).from(attachment).where(and(eq(attachment.id, id), eq(attachment.pbiId, adoId)));

  if (!row) {
    return { text: `No attachment ${ref} on PBI-${adoId}.`, isError: true };
  }

  if (row.text === null) {
    return { text: `${ref} (${row.fileName}) has no text: images can't be read yet.` };
  }

  return { text: textPage(row.text, offset) };
}
