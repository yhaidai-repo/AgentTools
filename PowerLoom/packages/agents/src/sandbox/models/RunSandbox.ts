import type { SandboxInfo } from "@powerloom/sandbox";

// The run's sandbox as its tools share it: none until sandbox_open, and the repos copied in so far.
export interface RunSandbox {
  info: SandboxInfo | null;
  repos: string[];
}
