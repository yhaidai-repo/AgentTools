import type { CodexLoginProcess } from "./CodexLoginProcess";

export interface CodexDeviceLoginOptions {
  /** Starts `codex login --device-auth` in the given Codex home. */
  spawn: (codexHome: string) => CodexLoginProcess;
  /** How long a start waits for the link and code. */
  codeWaitMs?: number;
  /** When an abandoned sign-in is killed. */
  signInTimeoutMs?: number;
}
