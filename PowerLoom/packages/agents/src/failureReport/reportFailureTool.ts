import { FAILURE_IMPACTS, FAILURE_KINDS, FAILURE_WORKAROUNDS } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { FailureReportRun, MAX_REPORTS_PER_RUN } from "./FailureReportRun";
import type { FailureReportStore } from "./models/FailureReportStore";
import type { NewFailureReport } from "./models/NewFailureReport";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";

const MAX_SAW_CHARS = 400;
const MAX_INSTEAD_CHARS = 300;
const MAX_TARGET_CHARS = 200;
const MAX_TOOL_CHARS = 80;

const input = {
  kind: z.enum(FAILURE_KINDS).describe("no_results: a search that gave nothing it should have; source_unreachable: a page that didn't load or search engines that didn't respond; tool_error: a tool failed and a retry didn't fix it; access_missing: you lack access; limit_reached: a cap or quota; other"),
  tool: z.string().trim().min(1).max(MAX_TOOL_CHARS).optional().describe("The tool that failed, as named (search_web, WebFetch, sql_query)"),
  target: z.string().trim().min(1).max(MAX_TARGET_CHARS).describe("What it was aimed at: a host, connection or resource name. Never the text of a search or a URL's query string"),
  saw: z.string().trim().min(1).max(MAX_SAW_CHARS).describe("What happened, as you saw it: the status, the error text, the engines that didn't respond. Never data a tool returned, secrets, or names of customers or patients"),
  workaround: z.enum(FAILURE_WORKAROUNDS).describe("What you did next: other_tool, other_query, continued_without or stopped"),
  instead: z.string().trim().min(1).max(MAX_INSTEAD_CHARS).optional().describe("In words, what you did instead, e.g. used native WebSearch"),
  impact: z.enum(FAILURE_IMPACTS).describe("How it changes your result: none, weaker_evidence, gap_in_result or blocked. A gap or a block is also named in your result"),
};

// report_failure: the agent's side of a failure the data access log already shows (what it did about it and what it
// costs the result). Written at once, not on the run's success: a run that dies later must still leave its reports.
export function createReportFailureTool(store: FailureReportStore, context: OutsideAccessContext, run: FailureReportRun): ToolDefinition<any> {
  return defineTool({
    name: "report_failure",
    description: `Report a failure that changed what you did, once per cause: a search with no results or engines that didn't respond, a page you couldn't read, a tool error a retry didn't fix, missing access, or a fallback you used. Not for a retry that worked or an expected "not found". Up to ${MAX_REPORTS_PER_RUN} per run.`,
    input,
    handler: async (fields) => {
      const report = reportOf(context, fields);
      const known = run.idOf(report);

      if (known !== undefined) {
        return { text: `Already reported as FR-${known}.` };
      }

      if (run.isFull) {
        return { text: `Report limit reached (${MAX_REPORTS_PER_RUN}). Put the rest in your result.` };
      }

      return { text: await saveReport(store, run, report) };
    },
  });
}

async function saveReport(store: FailureReportStore, run: FailureReportRun, report: NewFailureReport): Promise<string> {
  try {
    const id = await store.add(report);

    run.remember(report, id);

    return `Recorded as FR-${id}. Go on; name the gap in your result if there is one.`;
  } catch (error) {
    console.error(`failure report (run ${report.runId}) not written:`, error);

    return `Could not record the report (${(error as Error).message.slice(0, 100)}). Name the failure in your result.`;
  }
}

function reportOf(context: OutsideAccessContext, fields: z.infer<z.ZodObject<typeof input>>): NewFailureReport {
  return {
    vault: context.vault,
    agentId: context.agentId,
    runId: context.runId,
    taskId: context.taskId,
    pbiId: context.pbiId,
    kind: fields.kind,
    tool: fields.tool ?? null,
    target: fields.target,
    saw: fields.saw,
    workaround: fields.workaround,
    instead: fields.instead ?? null,
    impact: fields.impact,
  };
}
