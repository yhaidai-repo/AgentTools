// What an outside tool's handler returns: the agent's text, plus what the data access log keeps. The wrapper strips
// the extra fields before the runtime sees the result.
export interface OutsideToolResult {
  text: string;
  isError?: boolean;
  /** A guard said no (read-only check, cap): the reason, logged as `refused`. */
  refusal?: string;
  /** The outside system refused access (login, role, key): logged as `denied`. */
  denied?: boolean;
  rows?: number;
  truncated?: boolean;
}
