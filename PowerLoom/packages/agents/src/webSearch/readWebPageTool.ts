import type { AgentDefinition } from "@agenttools/config";
import { documentUrl } from "@powerloom/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { PAGE_CHARS, textPage } from "../textPages";
import type { WebPageTexts } from "../webDocuments/WebPageTexts";
import { POWERLOOM_WEB_INTEGRATION } from "./powerloomWebIntegration";

// read_web_page (user decision 2026-10-28): any public page, for an agent with PowerLoom web on. Codex has no page
// fetch of its own, and a page read here gets a source id its evidence can cite. A reading tool, logged by the run's
// ToolCallLogger (TOOL_KINDS): a page's 403 is the page's problem, not an access request.
export function createReadWebPageTools(agent: AgentDefinition, pages: WebPageTexts): ToolDefinition<any>[] {
  if (agent.capabilities.integrations?.[POWERLOOM_WEB_INTEGRATION] !== true) {
    return [];
  }

  return [defineTool({
    name: "read_web_page",
    description: `Read a public web page as text (HTML, PDF, Word, Excel), ${PAGE_CHARS} characters per call: a page a search found or a link you were given. Pages behind a sign-in can't be read.`,
    input: {
      url: z.string().url().describe("The page's full link, http or https"),
      offset: z.number().int().min(0).default(0).describe("Character offset; use the one the previous page gave"),
    },
    handler: async (input) => {
      const url = documentUrl(input.url);
      const text = await pages.textOf(url);

      if (!text.ok) {
        return { text: `${url} couldn't be read: ${text.error}.`, isError: true };
      }

      return { text: textPage(text.value, input.offset) };
    },
  })];
}
