import type { SDKTaskNotificationMessage, SDKTaskProgressMessage, SDKTaskStartedMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { SessionEndStatus } from "../../models/SessionEndStatus";
import type { SdkSubSessionFrame } from "./models/SdkSubSessionFrame";
import type { SdkTaskUsage } from "./models/SdkTaskUsage";

// Sub-agents and background tasks of a run. The SDK sends their frames under the parent's session id, so they are told
// apart by the id of the tool call that started them: every frame of a sub-agent names it as `parent_tool_use_id`, and
// `task_*` messages name it as `tool_use_id`. A background Bash command sends `task_*` without `subagent_type`
// (spike 2026-10-28).
export class SubSessions {
  private readonly openSessions = new Set<string>();
  private readonly endedSessions = new Set<string>();
  private readonly sessionOfTask = new Map<string, string>();
  private readonly sessionOfCall = new Map<string, string>();

  open(message: SDKTaskStartedMessage): EventBody[] {
    const sessionId = message.tool_use_id ?? message.task_id;

    this.openSessions.add(sessionId);
    this.sessionOfTask.set(message.task_id, sessionId);

    return [{
      type: "session_start",
      sessionId,
      parentSessionId: this.sessionOfCall.get(sessionId) ?? null,
      kind: message.subagent_type ? "subagent" : "background_task",
      name: message.subagent_type ?? null,
      description: message.description,
      taskId: message.task_id,
      background: message.is_backgrounded ?? false,
      inferred: false,
    }];
  }

  progress(message: SDKTaskProgressMessage): EventBody[] {
    const sessionId = this.sessionOfTask.get(message.task_id);

    if (!sessionId) {
      return [];
    }

    return [{ type: "session_progress", sessionId, ...fromTaskUsage(message.usage), lastToolName: message.last_tool_name ?? null }];
  }

  close(message: SDKTaskNotificationMessage): EventBody[] {
    const sessionId = this.sessionOfTask.get(message.task_id);

    if (!sessionId) {
      return [];
    }

    this.sessionOfTask.delete(message.task_id);
    this.end(sessionId);

    return [sessionEnd(sessionId, message.status, message.summary, message.usage)];
  }

  // The stream can end while a background sub-agent still works (the run was stopped); its session ends unfinished.
  closeOpen(): EventBody[] {
    const open = [...this.openSessions];

    open.forEach((sessionId) => this.end(sessionId));

    return open.map((sessionId) => sessionEnd(sessionId, "unfinished", null, undefined));
  }

  // Events of a frame with a `parent_tool_use_id` belong to that sub-session; their calls may start nested sessions.
  stamp(frame: SdkSubSessionFrame, bodies: EventBody[]): EventBody[] {
    const sessionId = frame.parent_tool_use_id;

    if (!sessionId) {
      return bodies;
    }

    const opened = this.openInferred(sessionId, frame);

    bodies.forEach((body) => this.rememberCall(body, sessionId));

    return [...opened, ...bodies.map((body) => ({ ...body, sessionId }))];
  }

  /** An event about a call, in the session that made the call; the main session's calls are not remembered. */
  stampCall(body: EventBody & { callId: string }): EventBody[] {
    const sessionId = this.sessionOfCall.get(body.callId);

    return [sessionId ? { ...body, sessionId } : body];
  }

  // A frame can come before its session's task_started; the session then opens from the frame, so no event names a
  // session the trace has not seen.
  private openInferred(sessionId: string, frame: SdkSubSessionFrame): EventBody[] {
    if (this.openSessions.has(sessionId) || this.endedSessions.has(sessionId)) {
      return [];
    }

    this.openSessions.add(sessionId);

    return [{
      type: "session_start",
      sessionId,
      parentSessionId: this.sessionOfCall.get(sessionId) ?? null,
      kind: "subagent",
      name: frame.subagent_type ?? null,
      description: frame.task_description ?? "",
      taskId: null,
      background: null,
      inferred: true,
    }];
  }

  private end(sessionId: string): void {
    this.openSessions.delete(sessionId);
    this.endedSessions.add(sessionId);
  }

  private rememberCall(body: EventBody, sessionId: string): void {
    if (body.type === "tool_call") {
      this.sessionOfCall.set(body.callId, sessionId);
    }
  }
}

function sessionEnd(sessionId: string, status: SessionEndStatus, summary: string | null, usage: SdkTaskUsage | undefined): EventBody {
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

function fromTaskUsage(usage: SdkTaskUsage): { totalTokens: number; toolUses: number; durationMs: number } {
  return { totalTokens: usage.total_tokens, toolUses: usage.tool_uses, durationMs: usage.duration_ms };
}
