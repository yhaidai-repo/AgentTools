import type { Outcome } from "@powerloom/core";
import { powerloomFailure } from "./powerloomFailure";

// An answer without a body (202 queued, 200 done): ok when PowerLoom took it, its problem otherwise.
export function accepted({ error, response }: { error?: unknown; response: Response }): Outcome<void> {
  return response.ok ? { ok: true, value: undefined } : powerloomFailure(error, response);
}
