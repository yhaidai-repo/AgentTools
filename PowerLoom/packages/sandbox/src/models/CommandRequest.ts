export interface CommandRequest {
  command: string;
  /** Under the workspace; the workspace itself when left out. */
  cwd?: string;
  timeoutMs: number;
}
