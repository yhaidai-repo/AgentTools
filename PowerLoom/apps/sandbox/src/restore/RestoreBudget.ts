import { deadlineAfter } from "../docker/execDeadlines";

// A step isn't started with less time than this: it couldn't do anything useful in it.
const MIN_STEP_MS = 5_000;

// One restore's time (SANDBOX_RESTORE_TIMEOUT_MS), counted from its call: its turn in the queue, copying the repo in and
// every step share it, so the call is answered within that time plus one exec's margin however many steps it has.
export class RestoreBudget {
  private readonly endsAt: number;

  constructor(
    timeoutMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.endsAt = now() + timeoutMs;
  }

  remainingMs(): number {
    return Math.max(0, this.endsAt - this.now());
  }

  isUsedUp(): boolean {
    return this.remainingMs() < MIN_STEP_MS;
  }

  /** The deadline of an exec that has its own cap and no `timeout` around it (copying the repo in). */
  deadlineWithin(capMs: number): number {
    return Math.min(capMs, deadlineAfter(this.remainingMs()));
  }
}
