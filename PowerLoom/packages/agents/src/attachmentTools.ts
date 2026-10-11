import { parseAttachmentRef } from "@powerloom/core";
import { attachment, type PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const PAGE_CHARS = 30_000;

// read_attachment: the text of the PBI's uploads (converted on upload), in pages so a long document can't flood the context.
export function createAttachmentTool(db: PowerLoomDb, adoId: number): ToolDefinition<any> {
  return defineTool({
    name: "read_attachment",
    description: `Read a file the user uploaded for this PBI (listed in <attachments>), as text, ${PAGE_CHARS} characters per call.`,
    input: {
      id: z.string().describe("Attachment id, e.g. ATT-3"),
      offset: z.number().int().min(0).default(0).describe("Character offset; use the one the previous page gave"),
    },
    handler: async (input) => {
      const id = parseAttachmentRef(input.id);
      const [row] = id === null ? [] : await db.select({ text: attachment.text, fileName: attachment.fileName }).from(attachment).where(and(eq(attachment.id, id), eq(attachment.pbiId, adoId)));

      if (!row) {
        return { text: `No attachment ${input.id} on this PBI.`, isError: true };
      }

      if (row.text === null) {
        return { text: `${input.id} (${row.fileName}) has no text: images can't be read yet.` };
      }

      return { text: page(row.text, input.offset) };
    },
  });
}

function page(text: string, offset: number): string {
  const end = Math.min(offset + PAGE_CHARS, text.length);
  const footer = end < text.length ? `[${end} of ${text.length} chars; continue with offset ${end}]` : `[end, ${text.length} chars]`;

  return `${text.slice(offset, end)}\n\n${footer}`;
}
