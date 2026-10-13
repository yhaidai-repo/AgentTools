import { extractAttachmentText } from "@powerloom/attachments";
import { documentUrl, type Outcome } from "@powerloom/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { PAGE_CHARS, textPage } from "../textPages";
import { downloadDocument } from "./documentDownload";
import type { WebDocumentRun } from "./models/WebDocumentRun";

// fetch_document: PowerLoom downloads a page from <web-documents> and reads it with the attachment readers (PDF, Word,
// Excel, HTML), which read what an agent's own web fetch often can't, e.g. a compressed PDF (2026-10-14). A reading
// tool: its pages get source ids. The text is kept for the run, so later pages don't download again.
export function createFetchDocumentTools(run: WebDocumentRun | null): ToolDefinition<any>[] {
  if (!run || run.urls.length === 0) {
    return [];
  }

  const texts = new Map<string, string>();

  return [defineTool({
    name: "fetch_document",
    description: `Read a page from <web-documents> as text (PDF, Word, Excel, HTML), ${PAGE_CHARS} characters per call. Try it first for every page.`,
    input: {
      url: z.string().describe("The page, as listed in <web-documents>"),
      offset: z.number().int().min(0).default(0).describe("Character offset; use the one the previous page gave"),
    },
    handler: async (input) => {
      const url = documentUrl(input.url);

      if (!run.urls.includes(url)) {
        return { text: `${url} isn't one of the pages in <web-documents>.`, isError: true };
      }

      const text = await textOf(url, texts);

      if (!text.ok) {
        return { text: `${url} couldn't be read: ${text.error}. Try your web tools; if they fail too, request_document.`, isError: true };
      }

      return { text: textPage(text.value, input.offset) };
    },
  })];
}

async function textOf(url: string, texts: Map<string, string>): Promise<Outcome<string>> {
  const known = texts.get(url);

  if (known !== undefined) {
    return { ok: true, value: known };
  }

  const read = await readDocument(url);

  if (read.ok) {
    texts.set(url, read.value);
  }

  return read;
}

async function readDocument(url: string): Promise<Outcome<string>> {
  const file = await downloadDocument(url);

  if (!file.ok) {
    return file;
  }

  const extracted = await extractAttachmentText(file.value);

  if (!extracted.ok) {
    return { ok: false, error: extracted.error };
  }

  return extracted.text === null ? { ok: false, error: "it is an image" } : { ok: true, value: extracted.text };
}
