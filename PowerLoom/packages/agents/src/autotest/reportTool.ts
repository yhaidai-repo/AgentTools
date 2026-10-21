import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { evidenceInput, resultStatusInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import type { AutotestDraft } from "./models/AutotestDraft";
import type { TestReport } from "./models/TestReport";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const REPORT_TOOL = "write_test_report";

const FINDING_KINDS = ["missing_test_case", "test_case_without_criterion", "contradiction", "missing_test_data", "ambiguous_expectation", "other"] as const;

const INPUT = {
  goal: z.string().min(1).describe("What the test proves, in one line"),
  status: resultStatusInput,
  summary: z.string().min(1).describe("2-5 sentences: what the criteria and test cases cover, what stops the test, what is planned"),
  analysis: z.array(z.object({
    kind: z.enum(FINDING_KINDS).describe("missing_test_case: a criterion no test case covers; test_case_without_criterion: a test case no criterion asks for; contradiction: criterion and test case expect different things; missing_test_data: a step needs data nobody gave; ambiguous_expectation: the expected result can be read two ways"),
    about: z.string().min(1).describe("'AC 3', 'TC-1234', 'AC 2 vs TC-1234'"),
    detail: z.string().min(1).describe("What exactly is missing or contradicts, quoting the criterion and the test case"),
    evidence: evidenceInput,
    resolution: z.string().min(1).describe("The task that resolves it: 'new:1' for the first task you created in this run, an existing item id, or why none is needed"),
  })).describe("Every gap between the acceptance criteria, the test cases and the test data; empty when they match"),
  cases: z.array(z.object({
    ref: z.string().min(1).describe("'TC-<id>' when the steps come from that test case; 'agent' when you wrote them because no test case covers the criterion; 'PBI-<id>' when it retests that bug of the PBI"),
    title: z.string().min(1),
    criterion: z.string().min(1).describe("The acceptance criterion this case proves, quoted"),
    steps: z.array(z.string().min(1)).min(1).describe("Concrete steps a person or a browser can follow: screen, action, value"),
    data: z.string().describe("The records, ids, users and environment the steps need, or 'none'"),
    expected: z.string().min(1).describe("The observable result that proves the criterion"),
    state: z.enum(["planned", "blocked"]).describe("blocked: an open finding stops this case until its task closes"),
    blocked_by: z.string().optional().describe("The task that unblocks a blocked case ('new:1' or an item id)"),
  })).describe("One case per acceptance criterion; a criterion with an open finding is a blocked case, not a missing one"),
  services: z.array(z.object({ name: z.string().min(1), why: z.string().min(1) })).default([]).describe("The services the cases need running (names from list_services) and why each"),
  results: z.array(z.object({
    case: z.string().min(1).describe("The planned case's title"),
    criterion: z.string().min(1),
    verdict: z.enum(["pass", "fail", "blocked", "not_run"]),
    observed: z.string().min(1).describe("What was seen against the expected result; for blocked / not_run: why"),
    artifacts: z.array(z.string()).default([]).describe("The case's recording files (from browser_close)"),
    bug: z.string().optional().describe("For a failed case: 'bug:<n>' from report_bug, or an existing bug id. For a case that retests a PBI bug: that bug's 'PBI-<id>', whatever the verdict (pass = fixed)"),
  })).default([]).describe("One entry per case you ran or could not run; empty while nothing ran yet"),
  ado_edits: z.array(z.string()).default([]).describe("Azure DevOps test cases to update by hand, one line each with the decision it follows; never a task"),
  next_reason: z.string().min(1).describe("Why the tasks you created with create_task are needed, or why no next step is"),
};

// The Autotest agent's report. Each call replaces the previous one, so the agent writes early and refines it.
export function createReportTool(draft: AutotestDraft, readLog: ReadLog) {
  return defineTool({
    name: REPORT_TOOL,
    description: "Save your test report: the analysis of the acceptance criteria against the test cases, and the plan. Write it as soon as the analysis stands (status partial is fine) and call again to replace it. Every finding cites its sources; a blocked case names the task that unblocks it.",
    input: INPUT,
    handler: async (input: Input) => {
      const problems = reportProblems(input, readLog);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.report = toReport(input);

      return { text: `Test report saved (${input.status}; ${input.cases.length} cases, ${input.analysis.length} findings, ${input.results.length} results).` };
    },
    replayOnResume: true,
  });
}

function reportProblems(input: Input, readLog: ReadLog): string[] {
  return [...evidenceProblems(input.analysis.flatMap((finding) => finding.evidence), readLog), ...blockedCaseProblems(input), ...failedCaseProblems(input)];
}

function blockedCaseProblems(input: Input): string[] {
  return input.cases.filter((planned) => planned.state === "blocked" && !planned.blocked_by).map((planned) => `blocked case "${planned.title}" needs blocked_by`);
}

// A failed case names its bug, or says in `observed` why none is reported ("no bug: …").
function failedCaseProblems(input: Input): string[] {
  return input.results.filter((result) => result.verdict === "fail" && !result.bug && !/no bug/i.test(result.observed)).map((result) => `failed case "${result.case}" needs bug (report_bug) or "no bug: why" in observed`);
}

function toReport(input: Input): TestReport {
  return {
    goal: input.goal,
    status: input.status,
    summary: input.summary,
    analysis: input.analysis,
    cases: input.cases.map((planned) => ({ ref: planned.ref, title: planned.title, criterion: planned.criterion, steps: planned.steps, data: planned.data, expected: planned.expected, state: planned.state, blockedBy: planned.blocked_by ?? null })),
    services: input.services,
    results: input.results.map((result) => ({ case: result.case, criterion: result.criterion, verdict: result.verdict, observed: result.observed, artifacts: result.artifacts, bug: result.bug ?? null })),
    adoEdits: input.ado_edits,
    nextReason: input.next_reason,
  };
}
