import type { SDKTaskNotificationMessage } from "@anthropic-ai/claude-agent-sdk";

// What a sub-agent or background task used, as task_progress and task_notification report it.
export type SdkTaskUsage = NonNullable<SDKTaskNotificationMessage["usage"]>;
