import type { StackServiceConfig } from "./StackServiceConfig";

// POST /stack. The owner (a run) is the only one whose stop DevHub accepts while the stack runs. config: per
// configurable service (list_services says which), what to set for this stack.
export interface StartStackRequest {
  services: string[];
  branch?: string;
  ttlMinutes?: number;
  owner: string;
  config?: Record<string, StackServiceConfig>;
}
