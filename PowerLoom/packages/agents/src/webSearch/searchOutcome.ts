import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { UnresponsiveEngine } from "./models/UnresponsiveEngine";
import type { WebSearchAnswer } from "./models/WebSearchAnswer";
import type { WebSearchHit } from "./models/WebSearchHit";

const SNIPPET_CHARS = 300;

// What the agent and the log get from one search. Engines that didn't respond are always named: with hits, the call is
// ok and they go into the log row's note; with no hits, the search failed, since the engines that might have had them
// didn't answer.
export function searchOutcome(query: string, answer: WebSearchAnswer, count: number): OutsideToolResult {
  const hits = answer.hits.slice(0, count);
  const engines = enginesLine(answer.unresponsiveEngines);

  if (hits.length > 0) {
    return { text: [hitsText(hits), engines].filter(Boolean).join("\n\n"), rows: hits.length, ...(engines ? { note: engines } : {}) };
  }

  if (engines) {
    return { text: `Web search found nothing for "${query}". ${engines} Use your own web search.`, isError: true };
  }

  return { text: `No results for "${query}".`, rows: 0 };
}

function hitsText(hits: WebSearchHit[]): string {
  return hits.map((hit, index) => [`${index + 1}. ${hit.title}`, `   ${hit.url}`, ...(hit.snippet ? [`   ${cut(hit.snippet)}`] : [])].join("\n")).join("\n");
}

function enginesLine(engines: UnresponsiveEngine[]): string {
  return engines.length === 0 ? "" : `Engines that did not respond: ${engines.map((engine) => `${engine.engine} (${engine.reason})`).join(", ")}.`;
}

function cut(snippet: string): string {
  return snippet.length > SNIPPET_CHARS ? `${snippet.slice(0, SNIPPET_CHARS)}…` : snippet;
}
