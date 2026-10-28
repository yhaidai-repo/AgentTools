export interface SessionStartRequest {
  command: string;
  cwd?: string;
  /** How long to collect output before answering; the answer comes sooner when the process exits. */
  yieldMs: number;
  maxChars: number;
}
