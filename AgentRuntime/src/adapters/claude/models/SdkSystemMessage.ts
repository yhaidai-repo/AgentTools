import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkSystemMessage = Extract<SDKMessage, { type: "system" }>;
