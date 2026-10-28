import type { ToolImage } from "@agenttools/runtime";

// What an outside tool's handler returns: the agent's text, plus what the data access log keeps. The wrapper strips
// the extra fields before the runtime sees the result.
export interface OutsideToolResult {
  text: string;
  isError?: boolean;
  /** Images the model sees beside the text (a screenshot); the log keeps only their count in `bytes`. */
  images?: ToolImage[];
  /** A guard said no (read-only check, cap): the reason, logged as `refused`. */
  refusal?: string;
  /** The outside system refused access (login, role, key): logged as `denied`. */
  denied?: boolean;
  /** What the log row should say about a call that worked anyway, e.g. the search engines that didn't respond. */
  note?: string;
  rows?: number;
  truncated?: boolean;
}
