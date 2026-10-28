import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { WebSearchSettings } from "@powerloom/core";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import type { WebSearchAnswer } from "./models/WebSearchAnswer";
import type { WebSearchClient } from "./models/WebSearchClient";
import type { WebSearchRequest } from "./models/WebSearchRequest";
import { SearchThrottle } from "./SearchThrottle";
import { createWebSearchTools } from "./webSearchTools";
import { WebSearchRequestError } from "./WebSearchRequestError";

const context = { vault: "work-projects", agentId: "better-research", runId: 42, owner: "powerloom-run-42", taskId: "AT-1-001", pbiId: 1 };
const SETTINGS: WebSearchSettings = { enabled: true, url: "http://searxng:8080", language: "uk-UA", maxSearchesPerRun: 2, minSecondsBetweenSearches: 0, cacheHours: 0 };
const HIT = { title: "HETS 270/271 Companion Guide", url: "https://www.cms.gov/files/hets.pdf", snippet: "AAA03" };

function agentWith(powerloomWeb: boolean): AgentDefinition {
  return { capabilities: { webAccess: !powerloomWeb, integrations: { powerloomWeb } } } as unknown as AgentDefinition;
}

function fakeDeps(answer: () => Promise<WebSearchAnswer>, webSearchOn = true) {
  const entries: DataAccessEntry[] = [];
  const requests: WebSearchRequest[] = [];
  const client: WebSearchClient = {
    search: async (request) => {
      requests.push(request);

      return answer();
    },
  };
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } };
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const webSearch = webSearchOn ? { client, throttle: new SearchThrottle(), settings: SETTINGS } : null;
  const deps = { outside, webSearch } as unknown as AgentDeps;

  return { deps, entries, requests };
}

function searchTool(deps: AgentDeps) {
  return createWebSearchTools(deps, agentWith(true), context)[0];
}

describe("search_web", () => {
  it("is given only to an agent with PowerLoom web on while web search is on, whatever its native web access", () => {
    const answer = async () => ({ hits: [], unresponsiveEngines: [] });

    assert.equal(createWebSearchTools(fakeDeps(answer).deps, agentWith(false), context).length, 0);
    assert.equal(createWebSearchTools(fakeDeps(answer, false).deps, agentWith(true), context).length, 0);
    assert.equal(searchTool(fakeDeps(answer).deps).name, "search_web");
  });

  it("searches in the settings' language and logs the query, with silent engines as the row's note", async () => {
    const { deps, entries, requests } = fakeDeps(async () => ({ hits: [HIT], unresponsiveEngines: [{ engine: "google", reason: "CAPTCHA" }] }));

    const result = await searchTool(deps).handler({ query: "HETS 270 AAA03", count: 10, freshness: "year" });

    assert.equal(result.isError, undefined);
    assert.deepEqual(requests, [{ query: "HETS 270 AAA03", language: "uk-UA", freshness: "year" }]);
    assert.equal(entries[0].tool, "search_web");
    assert.equal(entries[0].kind, "web");
    assert.equal(entries[0].request, "HETS 270 AAA03");
    assert.equal(entries[0].outcome, "ok");
    assert.equal(entries[0].reason, "Engines that did not respond: google (CAPTCHA).");
    assert.equal(entries[0].rows, 1);
  });

  it("refuses searches beyond the run's limit, logged as refused", async () => {
    const { deps, entries } = fakeDeps(async () => ({ hits: [HIT], unresponsiveEngines: [] }));
    const tool = searchTool(deps);

    await tool.handler({ query: "one", count: 10 });
    await tool.handler({ query: "two", count: 10 });
    const third = await tool.handler({ query: "three", count: 10 });

    assert.equal(third.isError, true);
    assert.match(third.text, /Web search limit reached: 2 searches per run/);
    assert.equal(entries[2].outcome, "refused");
  });

  it("answers an unavailable SearXNG as a failed call that points to the agent's own search", async () => {
    const { deps, entries } = fakeDeps(async () => {
      throw new WebSearchRequestError(0, "SearXNG at http://searxng:8080 can't be reached: fetch failed");
    });

    const result = await searchTool(deps).handler({ query: "hets", count: 10 });

    assert.equal(result.isError, true);
    assert.match(result.text, /^Web search is unavailable \(SearXNG at .* can't be reached: fetch failed\): use your own web search\.$/);
    assert.equal(entries[0].outcome, "failed");
  });
});
