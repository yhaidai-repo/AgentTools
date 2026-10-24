/** A running `codex login --device-auth`. */
export interface CodexLoginProcess {
  onOutput(listener: (text: string) => void): void;
  onExit(listener: (code: number | null) => void): void;
  kill(): void;
}
