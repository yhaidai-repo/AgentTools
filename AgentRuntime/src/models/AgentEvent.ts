import type { ErrorEvent } from "./ErrorEvent";
import type { RateLimitEvent } from "./RateLimitEvent";
import type { ResultEvent } from "./ResultEvent";
import type { TextEvent } from "./TextEvent";
import type { ToolCallEvent } from "./ToolCallEvent";
import type { ToolResultEvent } from "./ToolResultEvent";
import type { TurnUsageEvent } from "./TurnUsageEvent";

// Normalized run events; every adapter emits only these, ending with exactly one `result`.
export type AgentEvent =
  | TextEvent
  | ToolCallEvent
  | ToolResultEvent
  | TurnUsageEvent
  | RateLimitEvent
  | ResultEvent
  | ErrorEvent;
