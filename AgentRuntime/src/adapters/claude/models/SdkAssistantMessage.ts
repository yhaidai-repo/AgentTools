import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkAssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
