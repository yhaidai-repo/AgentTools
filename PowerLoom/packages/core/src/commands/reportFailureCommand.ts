import { FAILURE_IMPACTS, FAILURE_KINDS, FAILURE_WORKAROUNDS } from "@powerloom/db";
import { z } from "zod";
import { commandToolName } from "../commandToolName";
import { reportChatFailure } from "../failureReports/reportChatFailure";
import type { Command } from "../models/Command";
import { pbiIdInput, vaultInput } from "./inputs";

const POWERLOOM_MCP = "PowerLoom MCP";
const CHAT_AGENT = "chat";

const input = z.object({
  vault: vaultInput,
  kind: z.enum(FAILURE_KINDS).describe("tool_error: a PowerLoom tool failed and a retry didn't fix it; powerloom_unavailable: the PowerLoom server isn't answering or its tools are missing; no_results: a PowerLoom read gave nothing it should have; access_missing; limit_reached; other"),
  tool: z.string().trim().min(1).max(80).describe(`The PowerLoom tool that failed, as named (pbi_read, run_events), or '${POWERLOOM_MCP}' for the server itself. Failures of your own tools are not reported here`),
  target: z.string().trim().min(1).max(200).optional().describe("What it was aimed at, e.g. a PBI or run id or a vault; the tool's name when left out. Never data a tool returned"),
  saw: z.string().trim().min(1).max(400).describe("What happened, as you saw it: the error text or what was wrong. Never secrets or data a tool returned"),
  workaround: z.enum(FAILURE_WORKAROUNDS).describe("What you did next: other_tool, other_query, continued_without or stopped"),
  instead: z.string().trim().min(1).max(300).optional().describe("In words, what you did instead"),
  impact: z.enum(FAILURE_IMPACTS).describe("How it changes your answer: none, weaker_evidence, gap_in_result or blocked"),
  pbiId: pbiIdInput.optional().describe("The PBI you were working on, when one"),
});

type ReportFailureInput = z.infer<typeof input>;

// A chat's report of a PowerLoom failure (user decision 2026-10-28), the chat's side of what an agent's report_failure
// says for a run. Only PowerLoom's own tools: the chat's other tools are not PowerLoom's to track.
export const reportFailureCommand: Command<ReportFailureInput, { text: string }> = {
  name: "failure.report",
  description: "Record that a PowerLoom tool failed or the PowerLoom server isn't reachable, once per cause, when a retry didn't fix it and it changed what you did. It only records, so there is no need to ask the user first; say in one line what you reported. Not for a retry that worked, an expected 'not found', or your own tools (web search, shell, editor). The same cause again the same day answers with the first report's id.",
  input,
  async run(context, input) {
    if (!await isPowerLoomTool(input.tool)) {
      return { ok: false, error: `${input.tool} isn't a PowerLoom tool: only PowerLoom's own tools (pbi_read, run_events, …) or '${POWERLOOM_MCP}' are reported here.` };
    }

    const report = { vault: input.vault, origin: "chat" as const, agentId: CHAT_AGENT, actor: context.actor, runId: null, taskId: null, pbiId: input.pbiId ?? null, kind: input.kind, tool: input.tool, target: input.target ?? input.tool, saw: input.saw, workaround: input.workaround, instead: input.instead ?? null, impact: input.impact };
    const { id, repeat } = await reportChatFailure(context.db, report);

    return { ok: true, value: { text: repeat ? `Already reported today as FR-${id}.` : `Recorded as FR-${id}.` } };
  },
};

// The registry holds this command, so it is loaded when a report is made, not when this file is.
async function isPowerLoomTool(name: string): Promise<boolean> {
  const { COMMANDS } = await import("./commandRegistry");

  return name === POWERLOOM_MCP || COMMANDS.some((command) => commandToolName(command.name) === name);
}
