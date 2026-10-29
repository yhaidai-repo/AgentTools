import type { ServerOptions } from "node:http";
import { RESTORE_CALL_TIMEOUT_MS } from "@powerloom/sandbox";
import { deadlineAfter } from "../docker/execDeadlines";
import type { SandboxConfig } from "../models/SandboxConfig";

// Node checks its request timeouts every 30 s (connectionsCheckingInterval), so a limit can be passed by that much.
const REQUEST_MARGIN_MS = 60_000;

/** The longest a restore call works before it answers: its budget, then the last step's exec margin. */
export function restoreAnswerMs(config: SandboxConfig): number {
  return deadlineAfter(config.restoreTimeoutMs);
}

/** How long the server holds a request: longer than the longest restore or command it may be doing. */
export function requestTimeoutMs(config: SandboxConfig): number {
  return Math.max(restoreAnswerMs(config), deadlineAfter(config.maxCommandMs)) + REQUEST_MARGIN_MS;
}

// Node's server answers 408 and closes the socket when a request hasn't fully arrived within `requestTimeout`, 300 s by
// default. A restore's tar isn't read to its end before the restore is done (tar stops at its end marker, a queued
// restore reads nothing while it waits), so with the default a 15-minute restore got a 408 at 300 s and the agent
// called it again while it kept running (run 4402). Node's default headersTimeout (60 s) stays: headers come at once.
export function httpServerOptions(config: SandboxConfig): ServerOptions {
  return { requestTimeout: requestTimeoutMs(config) };
}

/** Refuses a restore time the client wouldn't wait for: it would give up before the service answers. */
export function checkRestoreFitsClient(config: SandboxConfig): void {
  const serverHoldsMs = restoreAnswerMs(config) + REQUEST_MARGIN_MS;

  if (serverHoldsMs >= RESTORE_CALL_TIMEOUT_MS) {
    throw new Error(`SANDBOX_RESTORE_TIMEOUT_MS ${config.restoreTimeoutMs} is too long: a restore call waits ${RESTORE_CALL_TIMEOUT_MS} ms, the service would hold it ${serverHoldsMs} ms`);
  }
}
