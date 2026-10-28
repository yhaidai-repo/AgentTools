import type { WebSearchSettings } from "@powerloom/core";
import type { SearchThrottle } from "../SearchThrottle";
import type { WebSearchClient } from "./WebSearchClient";

// PowerLoom's web search for a run: the provider, the runner's shared throttle, and the settings read for this run.
export interface WebSearchAccess {
  client: WebSearchClient;
  throttle: SearchThrottle;
  settings: WebSearchSettings;
}
