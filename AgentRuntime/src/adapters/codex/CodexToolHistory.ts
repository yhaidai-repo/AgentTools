import type { PastToolCall } from "../../models/PastToolCall";
import { toolResultText } from "../claude/MessageMapper";
import { neutralCodexToolName } from "./codexToolNames";
import { objectOf } from "./codexWindows";
import type { CodexHistoryCall } from "./models/CodexHistoryCall";

export class CodexToolHistory {
  private readonly calls = new Map<string, CodexHistoryCall>();
  private readonly completed = new Map<string, PastToolCall>();
  private lastOrder = 0;

  add(entry: Record<string, unknown>): void {
    switch (entry.type) {
      case "item.started":
      case "item.completed":
        this.addItem(objectOf(entry.item), entry.type === "item.completed");

        return;
      case "response_item":
        this.addResponse(objectOf(entry.payload));

        return;
      case "event_msg":
        this.addRuntimeEvent(objectOf(entry.payload));

        return;
    }
  }

  results(): PastToolCall[] {
    return [...this.calls.entries()].sort((a, b) => a[1].order - b[1].order)
      .flatMap(([id]) => this.completed.has(id) ? [this.completed.get(id)!] : []);
  }

  private addRuntimeEvent(payload: Record<string, unknown>): void {
    if (payload.type !== "item_completed" && payload.type !== "item_started") {
      return;
    }

    const item = objectOf(payload.item);

    this.addItem({ ...item, type: item.type === "McpToolCall" ? "mcp_tool_call" : item.type }, payload.type === "item_completed", payload.started_at_ms);
  }

  private addItem(item: Record<string, unknown>, complete: boolean, startedAt?: unknown): void {
    if (item.type !== "mcp_tool_call" || item.server !== "agent" || typeof item.id !== "string" || typeof item.tool !== "string") {
      return;
    }

    this.track(item.id, neutralCodexToolName(item.tool), item.arguments, startedAt);

    if (!complete || (item.status !== "completed" && item.status !== "failed")) {
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

  private track(id: string, name: string, input: unknown, startedAt?: unknown): void {
    if (this.calls.has(id)) {
      return;
    }

    const order = typeof startedAt === "number" && Number.isFinite(startedAt) ? startedAt : this.lastOrder + 1;

    this.lastOrder = Math.max(this.lastOrder, order);

    this.calls.set(id, { name, input, order });
  }

  private addResponse(payload: Record<string, unknown>): void {
    if (payload.type === "function_call" && typeof payload.name === "string" && payload.name.startsWith("mcp__agent__") && typeof payload.call_id === "string") {
      this.track(payload.call_id, neutralCodexToolName(payload.name), argumentsOf(payload.arguments));

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

    this.completed.set(callId, { callId, name: call.name, input: call.input, isError: result.isError === true, output });
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
