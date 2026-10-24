// Combines the caller's abort signal with the run timeout and remembers why the run stopped.
export class RunAbort {
  readonly controller = new AbortController();
  private reason: "timeout" | "aborted" | null = null;
  private readonly timer: NodeJS.Timeout;
  private readonly onCallerAbort = () => this.stop("aborted");

  constructor(timeoutMs: number, callerSignal?: AbortSignal) {
    this.timer = setTimeout(() => this.stop("timeout"), timeoutMs);
    callerSignal?.addEventListener("abort", this.onCallerAbort, { once: true });

    if (callerSignal?.aborted) {
      this.stop("aborted");
    }
  }

  get stopReason(): "timeout" | "aborted" | null {
    return this.reason;
  }

  dispose(callerSignal?: AbortSignal): void {
    clearTimeout(this.timer);
    callerSignal?.removeEventListener("abort", this.onCallerAbort);
  }

  private stop(reason: "timeout" | "aborted"): void {
    if (this.reason) {
      return;
    }

    this.reason = reason;
    this.controller.abort(reason);
  }
}
