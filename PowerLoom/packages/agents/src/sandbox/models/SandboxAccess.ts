import type { SandboxClient } from "@powerloom/sandbox";

// The sandbox service while the host has one (SANDBOX_URL and SANDBOX_TOKEN set): its client and where it points.
export interface SandboxAccess {
  client: SandboxClient;
  url: string;
}
