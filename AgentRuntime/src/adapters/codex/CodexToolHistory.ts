import type { PastToolCall } from "../../models/PastToolCall";
import { toolResultText } from "../claude/MessageMapper";
import { neutralCodexToolName } from "./codexToolNames";
import { objectOf } from "./codexWindows";

export class CodexToolHistory {
  private readonly calls = new Map<string, { name: string; input: unknown }>();
  private readonly completed = new Map<string, PastToolCall>();

  add(entry: Record<string, unknown>): void {
    if (entry.type === "item.completed") {
      this.addItem(objectOf(entry.item));

      return;
    }

    if (entry.type === "response_item") {
      this.addResponse(objectOf(entry.payload));
    }
  }

  results(): PastToolCall[] {
    return [...this.completed.values()];
  }

  private addItem(item: Record<string, unknown>): void {
    if (item.type !== "mcp_tool_call" || item.server !== "agent" || typeof item.id !== "string" || typeof item.tool !== "string") {
      return;
    }

    const result = objectOf(item.result);
    const error = objectOf(item.error);

    this.completed.set(item.id, {
      callId: item.id,
      name: neutralCodexToolName(item.tool),
      input: item.arguments,
      isError: item.status === "failed" || Boolean(item.error) || result.isError === true,
      output: typeof error.message === "string" ? error.message : toolResultText(result.content),
    });
  }

  private addResponse(payload: Record<string, unknown>): void {
    if (payload.type === "function_call" && typeof payload.name === "string" && payload.name.startsWith("mcp__agent__") && typeof payload.call_id === "string") {
      this.calls.set(payload.call_id, { name: neutralCodexToolName(payload.name), input: argumentsOf(payload.arguments) });

      return;
    }

    if (payload.type === "function_call_output" && typeof payload.call_id === "string") {
      this.addOutput(payload.call_id, payload.output);
    }
  }

  private addOutput(callId: string, value: unknown): void {
    const call = this.calls.get(callId);

    if (!call) {
      return;
    }

    const parsed = argumentsOf(value);
    const result = objectOf(parsed);
    const output = typeof parsed === "string" ? parsed : toolResultText(result.content);

    this.completed.set(callId, { callId, ...call, isError: result.isError === true, output });
  }
}

function argumentsOf(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
