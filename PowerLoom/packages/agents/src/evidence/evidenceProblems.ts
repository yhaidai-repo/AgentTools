import type { Evidence } from "../models/Evidence";
import type { ReadLog } from "./ReadLog";

// Each problem is written for the agent, so it can fix the evidence and call the tool again.
export function evidenceProblems(evidence: Evidence[], log: ReadLog): string[] {
  return evidence.map((item) => evidenceProblem(item, log)).filter((problem): problem is string => problem !== null);
}

const WEB_SOURCE = "web";

function evidenceProblem(item: Evidence, log: ReadLog): string | null {
  if (item.source.trim().toLowerCase() === WEB_SOURCE) {
    return webProblem(item, log);
  }

  const source = log.find(item.source);

  if (!source) {
    return `"${item.ref}" cites ${item.source}, which this run never read: read it and cite the source id that read ends with, or remove this evidence item (keep the claim only as (inferred), citing the sources you did read that it rests on)`;
  }

  if (item.quote && !containsQuote(source.text, item.quote)) {
    return `the quote for "${item.ref}" is not in ${source.id}: copy it exactly or leave it out`;
  }

  return null;
}

function webProblem(item: Evidence, log: ReadLog): string | null {
  const texts = log.web.textsWith(item.ref);

  if (texts.length === 0) {
    return `"${item.ref}" cites the web, but no WebSearch or WebFetch of this run shows that URL: give the page's URL as ref, or fetch it first`;
  }

  if (item.quote && !texts.some((text) => containsQuote(text, item.quote!))) {
    return `the quote for "${item.ref}" is not in what this run fetched from it: copy it exactly or leave it out`;
  }

  return null;
}

function containsQuote(text: string, quote: string): boolean {
  return comparable(text).includes(comparable(quote));
}

function comparable(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}
