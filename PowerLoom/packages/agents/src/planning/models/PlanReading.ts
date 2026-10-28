import type { PlanContent } from "@powerloom/db";

// The plan read from .planning/ with the inspect snapshot it came from, or why it can't be stored.
export type PlanReading =
  | { ok: true; content: PlanContent; inspect: unknown }
  | { ok: false; problem: string };
