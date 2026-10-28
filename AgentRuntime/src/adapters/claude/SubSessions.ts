import type { SDKTaskNotificationMessage, SDKTaskProgressMessage, SDKTaskStartedMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { SessionEndStatus } from "../../models/SessionEndStatus";

type TaskUsage = NonNullable<SDKTaskNotificationMessage["usage"]>;

// Sub-agents and background tasks of a run. The SDK sends their frames under the parent's session id, so they are told
// apart by the id of the tool call that started them: every frame of a sub-agent names it as `parent_tool_use_id`, and
// `task_*` messages name it as `tool_use_id`. A background Bash command sends `task_*` without `subagent_type`
// (spike 2026-10-28).
export class SubSessions {
  private readonly openByTask = new Map<string, string>();
  private readonly sessionOfCall = new Map<string, string>();

  open(message: SDKTaskStartedMessage): EventBody[] {
    const sessionId = message.tool_use_id ?? message.task_id;

    this.openByTask.set(message.task_id, sessionId);

    return [{
      type: "session_start",
      sessionId,
      parentSessionId: this.sessionOfCall.get(sessionId) ?? null,
      kind: message.subagent_type ? "subagent" : "background_task",
      name: message.subagent_type ?? null,
      description: message.description,
      taskId: message.task_id,
      background: message.is_backgrounded ?? false,
    }];
  }

  progress(message: SDKTaskProgressMessage): EventBody[] {
    const sessionId = this.openByTask.get(message.task_id);

    if (!sessionId) {
      return [];
    }

    return [{ type: "session_progress", sessionId, ...fromTaskUsage(message.usage), lastToolName: message.last_tool_name ?? null }];
  }

  close(message: SDKTaskNotificationMessage): EventBody[] {
    const sessionId = this.openByTask.get(message.task_id);

    if (!sessionId) {
      return [];
    }

    this.openByTask.delete(message.task_id);

    return [sessionEnd(sessionId, message.status, message.summary, message.usage)];
  }

  // The stream can end while a background sub-agent still works (the run was stopped); its session ends unfinished.
  closeOpen(): EventBody[] {
    const open = [...this.openByTask.values()];

    this.openByTask.clear();

    return open.map((sessionId) => sessionEnd(sessionId, "unfinished", null, undefined));
  }

  // Events of a frame with a `parent_tool_use_id` belong to that sub-session; their calls may start nested sessions.
  stamp(parentToolUseId: string | null, bodies: EventBody[]): EventBody[] {
    if (!parentToolUseId) {
      return bodies;
    }

    bodies.forEach((body) => this.rememberCall(body, parentToolUseId));

    return bodies.map((body) => ({ ...body, sessionId: parentToolUseId }));
  }

  private rememberCall(body: EventBody, sessionId: string): void {
    if (body.type === "tool_call") {
      this.sessionOfCall.set(body.callId, sessionId);
    }
  }
}

function sessionEnd(sessionId: string, status: SessionEndStatus, summary: string | null, usage: TaskUsage | undefined): EventBody {
  return {
    type: "session_end",
    sessionId,
    status,
    summary,
    totalTokens: usage?.total_tokens ?? null,
    toolUses: usage?.tool_uses ?? null,
    durationMs: usage?.duration_ms ?? null,
  };
}

function fromTaskUsage(usage: TaskUsage): { totalTokens: number; toolUses: number; durationMs: number } {
  return { totalTokens: usage.total_tokens, toolUses: usage.tool_uses, durationMs: usage.duration_ms };
}
