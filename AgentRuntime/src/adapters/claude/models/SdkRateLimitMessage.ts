import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SdkRateLimitMessage = Extract<SDKMessage, { type: "rate_limit_event" }>;
