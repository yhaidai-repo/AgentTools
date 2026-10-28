import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkUserMessage = Extract<SDKMessage, { type: "user" }>;
