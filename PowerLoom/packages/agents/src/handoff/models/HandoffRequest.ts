import type { HandoffGate, HandoffIntent } from "@powerloom/db";

// The parts of a hand_off call its own checks read.
export interface HandoffRequest {
  to: string;
  item: "task" | "question";
  intent: HandoffIntent;
  gate: HandoffGate;
  steps: unknown[];
  package: { results: string[]; items: string[] };
}
