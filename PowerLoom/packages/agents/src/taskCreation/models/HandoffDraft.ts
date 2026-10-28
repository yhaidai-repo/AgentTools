import type { HandoffPackage } from "@powerloom/core";
import type { HandoffGate, HandoffIntent } from "@powerloom/db";

// What hand_off adds to the task it creates: what it asks of the target and the package it carries. `package.refs.items`
// may name `new:<n>` like depends_on; the commit resolves them.
export interface HandoffDraft {
  intent: HandoffIntent;
  gate: HandoffGate;
  package: HandoffPackage;
}
