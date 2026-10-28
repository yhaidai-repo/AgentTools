export interface StdinRequest {
  /** Written as is; empty only reads what came since the last read. */
  chars: string;
  yieldMs: number;
  maxChars: number;
}
