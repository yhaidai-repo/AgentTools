import type { DevHubAnswer } from "./models/DevHubAnswer";
import type { StackStatus } from "./models/StackStatus";
import type { StackWait } from "./models/StackWait";

export interface WaitForStackOptions {
  timeoutMs: number;
  pollMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

// Polls DevHub until the stack left `starting` (ready, failed, or stopped by someone) or the time is up.
export async function waitForStack(status: () => Promise<DevHubAnswer<StackStatus>>, options: WaitForStackOptions): Promise<DevHubAnswer<StackWait>> {
  const sleep = options.sleep ?? delay;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let answer: DevHubAnswer<StackStatus>;

  do {
    await sleep(options.pollMs);
    answer = await status();
  } while (isStarting(answer) && now() < deadline);

  if (!answer.ok) {
    return answer;
  }

  return { ok: true, value: { status: answer.value, timedOut: answer.value.phase === "starting" } };
}

function isStarting(answer: DevHubAnswer<StackStatus>): boolean {
  return answer.ok && answer.value.phase === "starting";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
