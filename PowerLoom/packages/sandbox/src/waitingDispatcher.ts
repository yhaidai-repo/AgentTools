import { Agent } from "undici";

// Node's fetch gives up after 5 minutes without headers or body bytes; the service answers a restore or a long
// command only once it is done, so a call's pool waits as long as the call's own timeout.
export function waitingDispatcher(timeoutMs: number): Agent {
  return new Agent({ headersTimeout: timeoutMs, bodyTimeout: timeoutMs });
}
