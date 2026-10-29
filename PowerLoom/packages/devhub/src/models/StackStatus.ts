import type { StackPhase } from "./StackPhase";
import type { StackServiceState } from "./StackServiceState";

// GET /stack: DevHub's operation (phase, owner, start output) and what runs.
export interface StackStatus {
  strictBranch?: boolean;
  buildIdentity?: Record<string, string> | null;
  phase: StackPhase;
  running: boolean;
  requestedServices: string[];
  branch: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  exitCode: number | null;
  owner: string | null;
  services: StackServiceState[];
  output: string[];
}
