import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { evidenceInput, resultStatusInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import type { Evidence } from "../models/Evidence";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import type { BetterResearchResult } from "./models/BetterResearchResult";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const RESULT_TOOL = "write_research_result";

const INPUT = {
  question: z.string().min(1).describe("The task's question, restated in one line"),
  conclusion: z.string().min(1).describe("The answer first (yes/no/how/where/cause), then the key detail; 2-5 sentences"),
  status: resultStatusInput,
  findings: z.array(z.object({
    fact: z.string().min(1).describe("One fact"),
    evidence: evidenceInput,
    certainty: z.enum(["verified", "inferred"]).describe("verified: you read it in its source; inferred: concluded from what you read"),
  })).describe("What you found, one fact each, with its sources"),
  bug: z.object({
    cause: z.string().min(1).describe("Why the wrong state happens"),
    premise_checked: z.string().min(1).describe("How you confirmed the reported state is real: where, which data, which environment"),
    fix_alone_is_enough: z.enum(["yes", "no", "unknown"]).describe("Does fixing the cause alone remove every symptom?"),
    fix_alone_reason: z.string().min(1).describe("Why, with what already exists downstream"),
  }).nullable().default(null).describe("Bugs only"),
  options: z.array(z.object({
    option: z.string().min(1),
    pros: z.string(),
    cons: z.string(),
    evidence: evidenceInput,
  })).default([]).describe("Spikes and investigations: the options you found; don't choose the design"),
  not_found: z.array(z.object({ what: z.string().min(1), looked: z.string().min(1).describe("Where and how you searched") })).default([]),
  confidence: z.enum(["high", "medium", "low"]).describe("high: read the path end to end; medium: gaps remain; low: mostly inferred"),
  start_points: z.array(z.object({ location: z.string(), why: z.string() })).default([]).describe("Code locations whoever acts next should start from"),
  relevant_docs: z.array(z.object({ path: z.string(), why: z.string() })).default([]).describe("Docs whoever acts next should read"),
  relevant_pages: relevantPagesInput,
  next_reason: z.string().min(1).describe("Why the tasks you created with create_task are needed, or why no next step is"),
};

// Better Research's result. Each call replaces the previous one, so the agent can write early and refine it.
export function createResultTool(draft: BetterResearchDraft, readLog: ReadLog) {
  return defineTool({
    name: RESULT_TOOL,
    description: "Save your answer. Write it as soon as you have one (status partial is fine) and call again to replace it as you learn more. Every finding and option cites the sources it rests on.",
    input: INPUT,
    handler: async (input: Input) => {
      const problems = resultProblems(input, readLog);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.pages = input.relevant_pages;
      draft.result = toResult(input);

      return { text: `Research result saved (${input.status}).` };
    },
    replayOnResume: true,
  });
}

function resultProblems(input: Input, readLog: ReadLog): string[] {
  return [...evidenceProblems(citedEvidence(input), readLog), ...relevantPageProblems(input.relevant_pages), ...notFoundProblems(input)];
}

function citedEvidence(input: Input): Evidence[] {
  return [...input.findings.flatMap((finding) => finding.evidence), ...input.options.flatMap((option) => option.evidence)];
}

function notFoundProblems(input: Input): string[] {
  return input.status === "not_found" && input.not_found.length === 0 ? ["status not_found needs not_found: what you looked for and where"] : [];
}

function toResult(input: Input): BetterResearchResult {
  return {
    question: input.question,
    conclusion: input.conclusion,
    status: input.status,
    findings: input.findings,
    bug: input.bug && { cause: input.bug.cause, premiseChecked: input.bug.premise_checked, fixAloneIsEnough: input.bug.fix_alone_is_enough, fixAloneReason: input.bug.fix_alone_reason },
    options: input.options,
    notFound: input.not_found,
    confidence: input.confidence,
    startPoints: input.start_points,
    relevantDocs: input.relevant_docs,
    nextReason: input.next_reason,
  };
}
