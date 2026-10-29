import type { ToolCallContext } from "@agenttools/runtime";
import type { RestoreProgress, RestoreResult, SandboxAnswer } from "@powerloom/sandbox";
import { restoreEndText, restoreProgressText } from "./restoreProgressText";
import { whilePending } from "./whilePending";

// About as often as the SDK's own heartbeat, which carries the reports out (ToolReports).
const PROGRESS_EVERY_MS = 30_000;

type ProgressRead = () => Promise<SandboxAnswer<RestoreProgress | null>>;

// Tells the run's trace what a restore does while its call (up to 15 minutes) is pending: the service's progress of
// the restore, read every 30 s, and how it ended. A call without a context (outside a run) is not watched.
export class RestoreProgressReporter {
  private isFinished = false;

  constructor(
    private readonly read: ProgressRead,
    private readonly call: ToolCallContext | undefined,
    private readonly everyMs = PROGRESS_EVERY_MS,
  ) {}

  async watch(restoring: Promise<SandboxAnswer<RestoreResult>>): Promise<SandboxAnswer<RestoreResult>> {
    if (!this.call) {
      return restoring;
    }

    const answer = await whilePending(restoring, this.everyMs, () => this.poll());

    this.isFinished = true;
    this.call.progress(restoreEndText(answer));

    return answer;
  }

  // A read that answers after the restore did would report a stage the restore has left.
  private async poll(): Promise<void> {
    const answer = await this.read();

    if (this.isFinished || !answer.ok || !answer.value) {
      return;
    }

    this.call?.progress(restoreProgressText(answer.value, new Date()));
  }
}
