import type { UnresponsiveEngine } from "./UnresponsiveEngine";
import type { WebSearchHit } from "./WebSearchHit";

// What one search found, and the engines that didn't answer it.
export interface WebSearchAnswer {
  hits: WebSearchHit[];
  unresponsiveEngines: UnresponsiveEngine[];
}
