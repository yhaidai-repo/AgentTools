import type { McpToolCallItem, ThreadEvent, ThreadItem, Usage } from "@openai/codex-sdk";
import type { EventBody } from "../../EventSequence";
import type { RunEndReason } from "../../models/RunEndReason";
import { toolResultText } from "../claude/MessageMapper";
import { neutralCodexToolName } from "./codexToolNames";

export class CodexEventMapper {
  turns = 0;
  reason: RunEndReason = "failed";
  message: string | null = null;
  threadId: string | null = null;
  private failed = false;
  private readonly calls = new Set<string>();
  private readonly completed = new Set<string>();

  constructor(private readonly model: string) {}

  map(event: ThreadEvent): EventBody[] {
    switch (event.type) {
      case "thread.started":
        this.threadId = event.thread_id;

        return [];
      case "turn.completed":
        this.reason = this.failed ? this.reason : "success";

        return [this.usage(event.usage)];
      case "turn.failed":
        return this.failure(event.error.message);
      case "error":
        return this.failure(event.message);
      case "item.started":
        return this.start(event.item);
      case "item.completed":
        return this.complete(event.item);
      default:
        return [];
    }
  }

  private start(item: ThreadItem): EventBody[] {
    if (this.calls.has(item.id)) {
      return [];
    }

    const call = toolCallOf(item);

    if (!call) {
      return [];
    }

    this.calls.add(item.id);

    return [call];
  }

  private complete(item: ThreadItem): EventBody[] {
    if (this.completed.has(item.id)) {
      return [];
    }

    this.completed.add(item.id);

    if (item.type === "agent_message") {
      this.turns++;

      return [{ type: "text", text: item.text }];
    }

    if (item.type === "error") {
      return [{ type: "error", message: item.message }];
    }

    const start = this.start(item);
    const result = toolResultOf(item);

    if (!result) {
      return [];
    }

    this.turns += item.type === "mcp_tool_call" ? 1 : 0;

    return [...start, result];
  }

  private usage(usage: Usage): EventBody {
    return {
      type: "usage",
      model: this.model,
      inputTokens: Math.max(0, usage.input_tokens - usage.cached_input_tokens),
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cached_input_tokens,
      cacheWriteTokens: usage.cache_write_input_tokens ?? 0,
    };
  }

  private failure(message: string): EventBody[] {
    this.failed = true;
    this.reason = isCodexRateLimit(message) ? "rate-limited" : "failed";
    this.message = message;

    return [{ type: "error", message }];
  }
}

export function isCodexRateLimit(message: string): boolean {
  return /usage.?limit|rate.?limit|quota|too many requests|limit.*(?:reached|exceeded)|out of.*credits/i.test(message);
}

function toolCallOf(item: ThreadItem): EventBody | null {
  switch (item.type) {
    case "mcp_tool_call":
      return { type: "tool_call", callId: item.id, name: neutralCodexToolName(item.tool), input: item.arguments };
    case "web_search":
      return { type: "tool_call", callId: item.id, name: "web_search", input: { query: item.query } };
    case "command_execution":
      return { type: "tool_call", callId: item.id, name: "shell", input: { command: item.command } };
    case "file_change":
      return { type: "tool_call", callId: item.id, name: "apply_patch", input: { changes: item.changes } };
    default:
      return null;
  }
}

function toolResultOf(item: ThreadItem): EventBody | null {
  switch (item.type) {
    case "mcp_tool_call":
      return { type: "tool_result", callId: item.id, isError: mcpFailed(item), output: item.error?.message ?? toolResultText(item.result?.content) };
    case "web_search":
      return { type: "tool_result", callId: item.id, isError: false, output: item.query };
    case "command_execution":
      return { type: "tool_result", callId: item.id, isError: item.status === "failed" || (item.exit_code ?? 0) !== 0, output: item.aggregated_output };
    case "file_change":
      return { type: "tool_result", callId: item.id, isError: item.status === "failed", output: JSON.stringify(item.changes) };
    default:
      return null;
  }
}

function mcpFailed(item: McpToolCallItem): boolean {
  const result = item.result as (McpToolCallItem["result"] & { isError?: boolean }) | undefined;

  return item.status === "failed" || Boolean(item.error) || result?.isError === true;
}
