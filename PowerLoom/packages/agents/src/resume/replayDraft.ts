import type { AgentEvent, ConversationStore, PastToolCall, ToolDefinition } from "@agenttools/runtime";
import type { ReplayCall } from "./models/ReplayCall";
import type { ReplayOptions } from "./models/ReplayOptions";
import type { ReplayReport } from "./models/ReplayReport";

type Observe = (event: AgentEvent) => void;

// The run id on the events a replay shows, so observers can tell them from the run's own.
export const REPLAY_RUN = "replay";

// A run keeps its draft (decisions, created tasks, captures…) and what it read in memory until its commit, so a
// continued conversation starts with neither. The earlier successful calls are taken again in order, since a draft call
// may cite an earlier read: tools that only fill the draft are called again, tools that can restore their state (the
// recorded reads) do so from the earlier result, and the SDK's own tools (web) are shown to the run's observer. Other
// tools, which read or write at once, are never called again; nor are the draft calls when the draft was saved already.
export async function replayDraft(conversations: ConversationStore, conversationId: string, tools: ToolDefinition<any>[], options: ReplayOptions): Promise<ReplayReport> {
  const saved = new Set(options.withDrafts ? [] : tools.filter((tool) => tool.replayOnResume).map((tool) => tool.name));
  const past = (await conversations.toolCalls(conversationId)).filter((call) => !call.isError && !saved.has(call.name));
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const report: ReplayReport = { replayed: {}, restored: 0, failed: [] };

  for (const call of past) {
    await takeAgain(call, toolsByName.get(call.name), report, options.observe);
  }

  return report;
}

async function takeAgain(call: PastToolCall, tool: ToolDefinition<any> | undefined, report: ReplayReport, observe: Observe | undefined): Promise<void> {
  if (!tool) {
    showBuiltInCall(call, observe);

    return;
  }

  if (tool.replayOnResume) {
    await replayCall({ tool, input: call.input }, report);

    return;
  }

  restoreCall(call, tool, report);
}

function showBuiltInCall(call: PastToolCall, observe: Observe | undefined): void {
  const at = new Date();

  observe?.({ type: "tool_call", callId: call.callId, name: call.name, input: call.input, runId: REPLAY_RUN, seq: 0, at });
  observe?.({ type: "tool_result", callId: call.callId, isError: false, output: call.output, runId: REPLAY_RUN, seq: 0, at });
}

function restoreCall(call: PastToolCall, tool: ToolDefinition<any>, report: ReplayReport): void {
  if (!tool.restore) {
    return;
  }

  tool.restore(call.input, call.output);
  report.restored += 1;
}

async function replayCall(call: ReplayCall, report: ReplayReport): Promise<void> {
  const failure = await callFailure(call);

  if (failure) {
    report.failed.push(`${call.tool.name}: ${failure}`);

    return;
  }

  report.replayed[call.tool.name] = (report.replayed[call.tool.name] ?? 0) + 1;
}

async function callFailure(call: ReplayCall): Promise<string | null> {
  try {
    const result = await call.tool.handler(call.input as never);

    return result.isError ? result.text : null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
