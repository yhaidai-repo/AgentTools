import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ConfluenceClient } from "@powerloom/confluence";
import { htmlToMarkdown } from "@powerloom/vault";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";
import { defineOutsideTool } from "./outsideAccess";

export const CONFLUENCE_INTEGRATION = "confluence";

// A page's text is cut here so one long page can't fill the agent's context.
const MAX_PAGE_CHARS = 60_000;

// Atlassian answers 401 for a bad token and 403 for a page the account may not see: both are access, not errors.
const DENIED_STATUSES = [401, 403];

// The Confluence tools, for an agent with the integration switched on in its Config (user decision 2026-10-02) and a
// worker-side account set up (CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN). Read only. Search needs CONFLUENCE_SITE.
// Every call goes to the data access log.
export function createConfluenceTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[CONFLUENCE_INTEGRATION] === true;

  if (!isOn || !deps.confluence) {
    return [];
  }

  return [readPageTool(deps, context, deps.confluence), ...(deps.confluenceSite ? [searchTool(deps, context, deps.confluence, deps.confluenceSite)] : [])];
}

function readPageTool(deps: AgentDeps, context: OutsideAccessContext, client: ConfluenceClient) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_confluence_page",
    description: "Read a Confluence page as Markdown: a spec, design or how-to the PBI, a doc or a search result points to. Takes the page's link.",
    input: { url: z.string().url().describe("The page link, e.g. https://<site>.atlassian.net/wiki/spaces/AA/pages/123/Title") },
    resource: (input) => resourceOf(siteOf(input.url)),
    request: (input) => input.url,
    handler: async (input) => {
      try {
        const page = await client.page(input.url);
        const text = htmlToMarkdown(page.html);
        const cut = text.length > MAX_PAGE_CHARS ? `\n\n[cut at ${MAX_PAGE_CHARS} of ${text.length} characters]` : "";

        return { text: `# ${page.title} (version ${page.version})\n\n${text.slice(0, MAX_PAGE_CHARS)}${cut}`, rows: 1, truncated: cut.length > 0 };
      } catch (error) {
        return failure(`Can't read the page: ${(error as Error).message}`, error);
      }
    },
  });
}

function searchTool(deps: AgentDeps, context: OutsideAccessContext, client: ConfluenceClient, site: string) {
  return defineOutsideTool(deps.outside, context, {
    name: "search_confluence",
    description: "Find Confluence pages whose text matches, best match first. Returns titles, links and excerpts; read a page with read_confluence_page.",
    input: {
      text: z.string().min(2).describe("Words to find, e.g. a signal name or a feature"),
      space: z.string().optional().describe("A space key to search only that space, e.g. AA"),
    },
    resource: () => resourceOf(site),
    request: (input) => (input.space ? `search "${input.text}" in ${input.space}` : `search "${input.text}"`),
    handler: async (input) => {
      try {
        const hits = await client.search(site, input.text, input.space ?? null);
        const lines = hits.map((hit) => `- ${hit.title}: ${hit.url}${hit.excerpt ? ` – ${hit.excerpt}` : ""}`);

        return { text: lines.length > 0 ? lines.join("\n") : "No pages found.", rows: hits.length };
      } catch (error) {
        return failure(`Search failed: ${(error as Error).message}`, error);
      }
    },
  });
}

function failure(text: string, error: unknown): OutsideToolResult {
  const status = (error as { status?: number }).status;

  return { text, isError: true, denied: status !== undefined && DENIED_STATUSES.includes(status) };
}

// One Confluence site is one resource; its host names it.
function resourceOf(site: string): OutsideResource {
  return { kind: "confluence", resource: hostOf(site), target: site };
}

function siteOf(url: string): string {
  return `https://${hostOf(url)}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
