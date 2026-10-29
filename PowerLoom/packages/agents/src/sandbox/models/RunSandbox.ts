import type { SandboxInfo } from "@powerloom/sandbox";

// The run's sandbox as its tools share it: none until sandbox_open, the repos copied in so far, and the repos whose
// packages a restore has fetched into it (tried, whether or not every step worked).
export interface RunSandbox {
  info: SandboxInfo | null;
  repos: string[];
  restored: string[];
}
