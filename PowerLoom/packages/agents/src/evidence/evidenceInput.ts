import { z } from "zod";

// The evidence field every Better agent's result and task tools share (framework P5).
export const evidenceInput = z
  .array(
    z.object({
      source: z.string().min(1).describe("The source id a tool result ended with, e.g. 'S12'; 'S0' is the task message"),
      ref: z.string().min(1).describe("Where it is for a reader: '<repo>/<path>:<line>' and symbol, a doc path, a page link, a query and its environment, an item or attachment id, a URL"),
      note: z.string().min(1).describe("What this source shows, in one line"),
      quote: z.string().optional().describe("Optional: the exact words from that source that show it"),
    }),
  )
  .min(1);

export const resultStatusInput = z
  .enum(["complete", "partial", "not_found", "blocked"])
  .describe("complete: answered; partial: what you have so far; not_found: looked and it isn't there; blocked: something stops you, named in the result");
