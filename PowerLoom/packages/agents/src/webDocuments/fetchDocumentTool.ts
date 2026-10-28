import { documentUrl } from "@powerloom/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { PAGE_CHARS, textPage } from "../textPages";
import type { WebDocumentRun } from "./models/WebDocumentRun";
import type { WebPageTexts } from "./WebPageTexts";

// fetch_document: a page from <web-documents>, read by PowerLoom (see WebPageTexts). A reading tool: its pages get
// source ids.
export function createFetchDocumentTools(run: WebDocumentRun | null, pages: WebPageTexts): ToolDefinition<any>[] {
  if (!run || run.urls.length === 0) {
    return [];
  }

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

      const text = await pages.textOf(url);

      if (!text.ok) {
        return { text: `${url} couldn't be read: ${text.error}. Try your web tools; if they fail too, request_document.`, isError: true };
      }

      return { text: textPage(text.value, input.offset) };
    },
  })];
}
