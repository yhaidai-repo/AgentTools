import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkToolProgressMessage = Extract<SDKMessage, { type: "tool_progress" }>;
