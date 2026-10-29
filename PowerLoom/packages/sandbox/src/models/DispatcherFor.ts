import type { Dispatcher } from "undici";

// Builds the connection pool a sandbox call goes through, from how long the call may wait for its answer.
export type DispatcherFor = (timeoutMs: number) => Dispatcher;
