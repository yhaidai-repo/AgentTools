import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { optionalEvidenceInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import type { ResultDraft } from "./models/ResultDraft";
import type { RunResult } from "./RunResult";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const RESULT_TOOL = "write_result";

const INPUT = {
  status: z.enum(["complete", "partial", "blocked"]).describe("complete: the task is done; partial: what you have so far; blocked: something stops you, named in the result (the question or task you created)"),
  body: z.string().min(1).describe("The result in Markdown, in the sections your instructions ask for; the first line is its one-line summary"),
  data: z.record(z.string(), z.unknown()).optional().describe("The structured result, when your instructions ask for one"),
  evidence: optionalEvidenceInput.describe("Every source the result relies on"),
};

// The one way any agent records what its run produced (user decision 2026-10-22): one result per run, kept as the task's
// history and rendered under the task in the backlog vault. Agents with a result tool of their own call this one too.
export function createResultTool(result: RunResult, readLog: ReadLog): ToolDefinition<any> {
  return defineTool({
    name: RESULT_TOOL,
    description: "Record your run's result, once, at the end: its status, the result in Markdown and the evidence behind it. Call again to replace it. A question or task you created for what blocks you is reported here with status blocked.",
    input: INPUT,
    handler: async (input: Input) => {
      const problems = evidenceProblems(input.evidence, readLog);

      if (problems.length > 0) {
        return { text: `Result not recorded:\n- ${problems.join("\n- ")}` };
      }

      result.record(toDraft(input));

      return { text: `Result recorded (${input.status}).` };
    },
    replayOnResume: true,
  });
}

function toDraft(input: Input): ResultDraft {
  return { status: input.status, body: input.body, data: input.data ?? null, evidence: input.evidence };
}
