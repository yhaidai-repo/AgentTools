import type { BuildContent } from "@powerloom/db";

// The build read from .planning/ and git with the inspect snapshot it came from, or why it can't be stored.
export type BuildReading =
  | { ok: true; content: BuildContent; inspect: unknown }
  | { ok: false; problem: string };
