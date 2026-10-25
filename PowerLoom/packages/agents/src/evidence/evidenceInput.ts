import { z } from "zod";

const evidenceItemInput = z.object({
  source: z.string().min(1).describe("The source id a tool result ended with, e.g. 'S12'; 'S0' is the task message; 'web' for a page you searched or fetched (ref = its URL)"),
  ref: z.string().min(1).describe("Where it is for a reader: '<repo>/<path>:<line>' and symbol, a doc path, a page link, a query and its environment, an item or attachment id, a URL"),
  note: z.string().min(1).describe("What this source shows, in one line"),
  quote: z.string().optional().describe("Optional: the exact words from that source that show it"),
});

// The evidence field every Better agent's result and task tools share (framework P5).
export const evidenceInput = z.array(evidenceItemInput).min(1);

// Where a claim may still be unverified (e.g. a repo picked from the catalog): no evidence marks it so.
export const optionalEvidenceInput = z.array(evidenceItemInput).default([]);

export const resultStatusInput = z
  .enum(["complete", "partial", "not_found", "blocked"])
  .describe("complete: answered; partial: what you have so far; not_found: looked and it isn't there (write_result then says complete, or partial when the search was cut short); blocked: something stops you, named in the result");
