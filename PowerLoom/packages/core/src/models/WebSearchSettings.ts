// Settings → Data access → Web search (user decision 2026-10-28): one SearXNG for the whole PowerLoom, run next to it,
// and the pace agents search at. Saved by PowerLoom's backend; read here. No secret: SearXNG is reachable only on
// Docker's network.
export interface WebSearchSettings {
  enabled: boolean;
  url: string;
  /** SearXNG's `language`, e.g. uk-UA; the page fills it from the machine's locale. */
  language: string;
  maxSearchesPerRun: number;
  minSecondsBetweenSearches: number;
  cacheHours: number;
}
