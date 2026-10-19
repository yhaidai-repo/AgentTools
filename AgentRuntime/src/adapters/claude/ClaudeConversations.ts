import { deleteSession, getSessionInfo, getSessionMessages, type SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ConversationStore } from "../../models/ConversationStore";
import type { PastToolCall } from "../../models/PastToolCall";
import type { SdkToolResult } from "./models/SdkToolResult";
import type { SdkToolUse } from "./models/SdkToolUse";
import { toolResultText } from "./MessageMapper";
import { toNeutralToolName } from "./toSdkTools";

// The SDK's session transcripts under CLAUDE_CONFIG_DIR (the agent-runner puts it on a volume, so they outlive a restart).
export class ClaudeConversations implements ConversationStore {
  constructor(private readonly projectDir: string) {}

  async exists(id: string): Promise<boolean> {
    return (await getSessionInfo(id, { dir: this.projectDir })) !== undefined;
  }

  async toolCalls(id: string): Promise<PastToolCall[]> {
    const messages = await getSessionMessages(id, { dir: this.projectDir });
    const mainMessages = messages.filter((message) => message.parent_tool_use_id === null);
    const results = toolResults(mainMessages);

    return toolUses(mainMessages).flatMap((use) => {
      const result = results.get(use.id);

      return result ? [{ callId: use.id, name: toNeutralToolName(use.name), input: use.input, ...result }] : [];
    });
  }

  async remove(id: string): Promise<void> {
    await deleteSession(id, { dir: this.projectDir });
  }
}

function toolUses(messages: SessionMessage[]): SdkToolUse[] {
  return messages.filter((message) => message.type === "assistant").flatMap((message) => contentBlocks(message)).filter(isToolUse);
}

// Tool use id → its result; a call without a result (the process stopped during it) is missing.
function toolResults(messages: SessionMessage[]): Map<string, SdkToolResult> {
  const results = messages.filter((message) => message.type === "user").flatMap((message) => contentBlocks(message)).filter(isToolResult);

  return new Map(results.map((block) => [block.tool_use_id, { isError: block.is_error ?? false, output: toolResultText(block.content) }]));
}

function contentBlocks(message: SessionMessage): Record<string, unknown>[] {
  const content = (message.message as { content?: unknown } | null)?.content;

  return Array.isArray(content) ? content : [];
}

function isToolUse(block: Record<string, unknown>): block is Record<string, unknown> & SdkToolUse {
  return block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string";
}

function isToolResult(block: Record<string, unknown>): block is Record<string, unknown> & { tool_use_id: string; is_error?: boolean; content?: unknown } {
  return block.type === "tool_result" && typeof block.tool_use_id === "string";
}
