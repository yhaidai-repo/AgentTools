import type { SearxngResponse } from "./models/SearxngResponse";
import type { WebSearchAnswer } from "./models/WebSearchAnswer";
import type { WebSearchClient } from "./models/WebSearchClient";
import type { WebSearchRequest } from "./models/WebSearchRequest";
import { WebSearchRequestError } from "./WebSearchRequestError";

// SearXNG waits about 3 s per engine; this only guards against a hung container.
const TIMEOUT_MS = 20_000;

// SearXNG answers 403 to a format its settings.yml doesn't list, and JSON is off by default.
const FORBIDDEN = 403;

// The self-hosted SearXNG next to PowerLoom (user decision 2026-10-28): general engines, no account, searching from
// the machine's own address. It is reached only on Docker's network, so nothing secret is sent.
export class SearxngClient implements WebSearchClient {
  constructor(private readonly url: string, private readonly fetchFn: typeof fetch = fetch) {}

  async search(request: WebSearchRequest): Promise<WebSearchAnswer> {
    const response = await this.get(this.searchUrl(request));

    if (!response.ok) {
      await response.body?.cancel();
      throw new WebSearchRequestError(response.status, statusMessage(response.status));
    }

    return answerOf((await response.json()) as SearxngResponse);
  }

  private async get(url: string): Promise<Response> {
    try {
      return await this.fetchFn(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new WebSearchRequestError(0, `SearXNG at ${this.url} can't be reached: ${(error as Error).message}`);
    }
  }

  private searchUrl(request: WebSearchRequest): string {
    const params = new URLSearchParams({ q: request.query, format: "json", language: request.language });

    if (request.freshness) {
      params.set("time_range", request.freshness);
    }

    return `${this.url.replace(/\/+$/, "")}/search?${params}`;
  }
}

function statusMessage(status: number): string {
  return status === FORBIDDEN ? "SearXNG refuses JSON: add json to search.formats in its settings.yml" : `SearXNG answered HTTP ${status}`;
}

function answerOf(response: SearxngResponse): WebSearchAnswer {
  const hits = (response.results ?? []).filter((result) => result.url).map((result) => ({ title: result.title?.trim() || result.url!, url: result.url!, snippet: result.content?.trim() ?? "" }));
  const unresponsiveEngines = (response.unresponsive_engines ?? []).map(([engine, reason]) => ({ engine, reason }));

  return { hits, unresponsiveEngines };
}
