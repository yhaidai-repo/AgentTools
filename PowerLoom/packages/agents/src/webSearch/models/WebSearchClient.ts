import type { WebSearchAnswer } from "./WebSearchAnswer";
import type { WebSearchRequest } from "./WebSearchRequest";

// A search provider (SearXNG today); a refused or failed call throws WebSearchRequestError.
export interface WebSearchClient {
  search(request: WebSearchRequest): Promise<WebSearchAnswer>;
}
