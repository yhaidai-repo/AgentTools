// How recent a result must be, as SearXNG's time_range takes it.
export const SEARCH_FRESHNESS = ["day", "month", "year"] as const;

export type SearchFreshness = (typeof SEARCH_FRESHNESS)[number];
