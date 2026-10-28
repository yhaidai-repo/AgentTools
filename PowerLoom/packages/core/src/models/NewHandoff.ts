import type { HandoffGate, HandoffIntent, HandoffTargetKind } from "@powerloom/db";
import type { HandoffPackage } from "./HandoffPackage";
import type { HandoffSender } from "./HandoffSender";

// A hand-off before its target item exists: what the human task body is rendered from.
export interface NewHandoff {
  from: HandoffSender;
  toKind: HandoffTargetKind;
  intent: HandoffIntent;
  gate: HandoffGate;
  package: HandoffPackage;
}
