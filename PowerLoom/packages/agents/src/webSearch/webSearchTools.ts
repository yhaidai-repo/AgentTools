import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideAccessServices } from "../models/OutsideAccessServices";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { SEARCH_FRESHNESS, type SearchFreshness } from "./models/SearchFreshness";
import type { WebSearchAccess } from "./models/WebSearchAccess";
import { searchOutcome } from "./searchOutcome";
import { WebSearchRequestError } from "./WebSearchRequestError";

const MAX_COUNT = 20;
const DEFAULT_COUNT = 10;

// search_web (user decision 2026-10-28): PowerLoom's own search, for an agent with web access while Settings → Web
// search is on, next to the provider's native search. Every call goes to the data access log, with the engines that
// didn't respond.
export function createWebSearchTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  if (!agent.capabilities.webAccess || !deps.webSearch) {
    return [];
  }

  return [searchTool(deps.outside, context, deps.webSearch)];
}

function searchTool(services: OutsideAccessServices, context: OutsideAccessContext, access: WebSearchAccess): ToolDefinition<any> {
  const { settings } = access;
  let searches = 0;

  return defineOutsideTool(services, context, {
    name: "search_web",
    description: `Search the public web with PowerLoom's own search; prefer it to your own web search, and use yours when this fails or finds nothing. Returns titles, links and snippets, at most ${MAX_COUNT}; read a page with read_web_page. A query holds only public terms (a product, standard, API, error text, rule name): never a customer, patient, member, PBI id or title, an internal name or host, or code from the repos.`,
    input: {
      query: z.string().trim().min(2).max(400).describe("Public search words, e.g. HETS 270 companion guide AAA03; site:cms.gov limits it to one site"),
      count: z.number().int().min(1).max(MAX_COUNT).default(DEFAULT_COUNT).describe("Results to return"),
      freshness: z.enum(SEARCH_FRESHNESS).optional().describe("Only results from the last day, month or year"),
    },
    resource: () => ({ kind: "web", resource: "web search (searxng)", target: settings.language }),
    request: (input) => input.query,
    handler: async (input) => {
      if (searches >= settings.maxSearchesPerRun) {
        return limitReached(settings.maxSearchesPerRun);
      }

      searches++;

      return answered(access, input.query, input.count, input.freshness ?? null);
    },
  });
}

async function answered(access: WebSearchAccess, query: string, count: number, freshness: SearchFreshness | null): Promise<OutsideToolResult> {
  const request = { query, language: access.settings.language, freshness };

  try {
    const answer = await access.throttle.search(request, access.settings, () => access.client.search(request));

    return searchOutcome(query, answer, count);
  } catch (error) {
    if (!(error instanceof WebSearchRequestError)) {
      throw error;
    }

    return { text: `Web search is unavailable (${error.message}): use your own web search.`, isError: true };
  }
}

function limitReached(max: number): OutsideToolResult {
  const refusal = `${max} searches per run (Settings → Web search)`;

  return { text: `Web search limit reached: ${refusal}. Use your own web search.`, isError: true, refusal };
}
