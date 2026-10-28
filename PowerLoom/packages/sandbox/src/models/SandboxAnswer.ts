import type { SandboxFailure } from "./SandboxFailure";

// The sandbox service's answer: the value, or why not.
export type SandboxAnswer<T> = { ok: true; value: T } | { ok: false; message: string; failure: SandboxFailure };
