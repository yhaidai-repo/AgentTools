import type { Evidence } from "../models/Evidence";
import type { ReadLog } from "./ReadLog";

// Each problem is written for the agent, so it can fix the evidence and call the tool again.
export function evidenceProblems(evidence: Evidence[], log: ReadLog): string[] {
  return evidence.map((item) => evidenceProblem(item, log)).filter((problem): problem is string => problem !== null);
}

function evidenceProblem(item: Evidence, log: ReadLog): string | null {
  const source = log.find(item.source);

  if (!source) {
    return `"${item.ref}" cites ${item.source}, which this run never read: read it first, or drop the claim or mark it (inferred)`;
  }

  if (item.quote && !containsQuote(source.text, item.quote)) {
    return `the quote for "${item.ref}" is not in ${source.id}: copy it exactly or leave it out`;
  }

  return null;
}

function containsQuote(text: string, quote: string): boolean {
  return comparable(text).includes(comparable(quote));
}

function comparable(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}
