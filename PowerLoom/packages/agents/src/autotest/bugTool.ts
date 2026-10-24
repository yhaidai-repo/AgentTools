import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { evidenceInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import type { AutotestDraft } from "./models/AutotestDraft";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const BUG_TOOL = "report_bug";
const MAX_BUGS_PER_RUN = 10;

const INPUT = {
  title: z.string().min(1).max(120).describe("What is wrong, in one line, as a bug title"),
  criterion: z.string().min(1).describe("The acceptance criterion the case proves, quoted"),
  case: z.string().min(1).describe("The planned case's title"),
  steps: z.array(z.string().min(1)).min(1).describe("Steps to reproduce, as run: screen, action, value"),
  expected: z.string().min(1),
  actual: z.string().min(1).describe("What the page or the API showed instead"),
  evidence: evidenceInput,
  artifacts: z.array(z.string()).default([]).describe("The case's recording files on the host (from browser_close), screenshots first"),
  suspected_cause: z.string().optional().describe("Where in the code the cause may be, when the logs or the code point to it; mark it (inferred)"),
  priority: z.number().int().min(1).max(4).optional().describe("1 = blocks the feature … 4 = cosmetic"),
};

// A bug found by a failed case (design 2026-10-20): collected during the run, created in PowerLoom at the commit as a
// [BUG] task under the PBI (never in Azure DevOps). A case that fails because of a plan or data problem is a finding or
// a question, not a bug.
export function createBugTool(draft: AutotestDraft, readLog: ReadLog) {
  return defineTool({
    name: BUG_TOOL,
    description: "Report a bug a case proved on the stack: the criterion, the steps as run, expected vs actual, the evidence and the recording. One bug per distinct failure; a failure caused by the plan, the data or the environment is a finding or a question instead. Answers with bug:<n> to cite in the report.",
    input: INPUT,
    handler: async (input: Input) => {
      const problems = [...evidenceProblems(input.evidence, readLog), ...capProblems(draft)];

      if (problems.length > 0) {
        return { text: `Not reported, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.bugs.push({ title: input.title, criterion: input.criterion, case: input.case, steps: input.steps, expected: input.expected, actual: input.actual, evidence: input.evidence, artifacts: input.artifacts, suspectedCause: input.suspected_cause ?? null, priority: input.priority ?? null });

      return { text: `Noted as bug:${draft.bugs.length}; it is created in PowerLoom when your run succeeds. Cite it in the case's result.` };
    },
    replayOnResume: true,
  });
}

function capProblems(draft: AutotestDraft): string[] {
  return draft.bugs.length >= MAX_BUGS_PER_RUN ? [`at most ${MAX_BUGS_PER_RUN} bugs per run; put the rest into the report`] : [];
}

// The bug's description as the PBI page shows it and as the next agent reads it.
export function renderBug(bug: AutotestDraft["bugs"][number], pbiId: number): string {
  return [
    `Found by the Autotest agent on PBI-${pbiId}, case "${bug.case}".`,
    `**Criterion:** ${bug.criterion}`,
    "**Steps to reproduce**",
    ...bug.steps.map((step, index) => `${index + 1}. ${step}`),
    `**Expected:** ${bug.expected}`,
    `**Actual:** ${bug.actual}`,
    ...(bug.suspectedCause ? [`**Suspected cause:** ${bug.suspectedCause}`] : []),
    "**Evidence**",
    ...bug.evidence.map((item) => `- ${item.ref}: ${item.note}`),
    ...(bug.artifacts.length > 0 ? ["**Recording**", ...bug.artifacts.map((path) => `- ${path}`)] : []),
  ].join("\n");
}
