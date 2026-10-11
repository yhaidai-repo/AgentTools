import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import type { AgentDefinition } from "@agenttools/config";
import type { ConfluenceClient } from "@powerloom/confluence";
import { htmlToMarkdown } from "@powerloom/vault";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";

export const CONFLUENCE_INTEGRATION = "confluence";

// A page's text is cut here so one long page can't fill the agent's context.
const MAX_PAGE_CHARS = 60_000;

// The Confluence tools, for an agent with the integration switched on in its Config (user decision 2026-10-02) and a
// worker-side account set up (CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN). Read only. Search needs CONFLUENCE_SITE.
export function createConfluenceTools(deps: AgentDeps, agent: AgentDefinition): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[CONFLUENCE_INTEGRATION] === true;

  if (!isOn || !deps.confluence) {
    return [];
  }

  return [readPageTool(deps.confluence), ...(deps.confluenceSite ? [searchTool(deps.confluence, deps.confluenceSite)] : [])];
}

function readPageTool(client: ConfluenceClient) {
  return defineTool({
    name: "read_confluence_page",
    description: "Read a Confluence page as Markdown: a spec, design or how-to the PBI, a doc or a search result points to. Takes the page's link.",
    input: { url: z.string().url().describe("The page link, e.g. https://<site>.atlassian.net/wiki/spaces/AA/pages/123/Title") },
    handler: async (input) => {
      try {
        const page = await client.page(input.url);
        const text = htmlToMarkdown(page.html);
        const cut = text.length > MAX_PAGE_CHARS ? `\n\n[cut at ${MAX_PAGE_CHARS} of ${text.length} characters]` : "";

        return { text: `# ${page.title} (version ${page.version})\n\n${text.slice(0, MAX_PAGE_CHARS)}${cut}` };
      } catch (error) {
        return { text: `Can't read the page: ${(error as Error).message}`, isError: true };
      }
    },
  });
}

function searchTool(client: ConfluenceClient, site: string) {
  return defineTool({
    name: "search_confluence",
    description: "Find Confluence pages whose text matches, best match first. Returns titles, links and excerpts; read a page with read_confluence_page.",
    input: {
      text: z.string().min(2).describe("Words to find, e.g. a signal name or a feature"),
      space: z.string().optional().describe("A space key to search only that space, e.g. AA"),
    },
    handler: async (input) => {
      try {
        const hits = await client.search(site, input.text, input.space ?? null);
        const lines = hits.map((hit) => `- ${hit.title}: ${hit.url}${hit.excerpt ? ` – ${hit.excerpt}` : ""}`);

        return { text: lines.length > 0 ? lines.join("\n") : "No pages found." };
      } catch (error) {
        return { text: `Search failed: ${(error as Error).message}`, isError: true };
      }
    },
  });
}
