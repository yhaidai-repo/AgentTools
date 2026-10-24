import type { Outcome } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";

// A command that answers with a message, as the line under a form shows it.
export function messageResult(outcome: Outcome<{ message: string }>): ActionResult {
  return outcome.ok ? { ok: true, message: outcome.value.message } : { ok: false, message: outcome.error };
}
