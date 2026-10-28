import type { SearchFreshness } from "./SearchFreshness";

export interface WebSearchRequest {
  query: string;
  language: string;
  freshness: SearchFreshness | null;
}
