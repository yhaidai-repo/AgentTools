import type { StackStatus } from "./StackStatus";

// The stack's status once it left `starting`, or the last one seen when the wait ran out.
export interface StackWait {
  status: StackStatus;
  timedOut: boolean;
}
