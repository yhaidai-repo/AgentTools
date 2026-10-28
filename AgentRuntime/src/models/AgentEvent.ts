import type { ErrorEvent } from "./ErrorEvent";
import type { RateLimitEvent } from "./RateLimitEvent";
import type { ResultEvent } from "./ResultEvent";
import type { SessionEndEvent } from "./SessionEndEvent";
import type { SessionProgressEvent } from "./SessionProgressEvent";
import type { SessionStartEvent } from "./SessionStartEvent";
import type { TextEvent } from "./TextEvent";
import type { ToolCallEvent } from "./ToolCallEvent";
import type { ToolProgressEvent } from "./ToolProgressEvent";
import type { ToolResultEvent } from "./ToolResultEvent";
import type { TurnUsageEvent } from "./TurnUsageEvent";

// Normalized run events; every adapter emits only these, ending with exactly one `result`.
export type AgentEvent =
  | TextEvent
  | ToolCallEvent
  | ToolProgressEvent
  | ToolResultEvent
  | TurnUsageEvent
  | RateLimitEvent
  | SessionStartEvent
  | SessionProgressEvent
  | SessionEndEvent
  | ResultEvent
  | ErrorEvent;
