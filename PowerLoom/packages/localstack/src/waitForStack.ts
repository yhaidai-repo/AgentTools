import type { BridgeAnswer } from "./models/BridgeAnswer";
import type { StackStatus } from "./models/StackStatus";
import type { StackWait } from "./models/StackWait";

export interface WaitForStackOptions {
  timeoutMs: number;
  pollMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

// Polls the bridge until the stack left `starting` (ready, failed, or stopped by someone) or the time is up.
export async function waitForStack(status: () => Promise<BridgeAnswer<StackStatus>>, options: WaitForStackOptions): Promise<BridgeAnswer<StackWait>> {
  const sleep = options.sleep ?? delay;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let answer: BridgeAnswer<StackStatus>;

  do {
    await sleep(options.pollMs);
    answer = await status();
  } while (isStarting(answer) && now() < deadline);

  if (!answer.ok) {
    return answer;
  }

  return { ok: true, value: { status: answer.value, timedOut: answer.value.phase === "starting" } };
}

function isStarting(answer: BridgeAnswer<StackStatus>): boolean {
  return answer.ok && answer.value.phase === "starting";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
