import type { HandoffRefs } from "@powerloom/db";

// What a hand-off carries: the sender's markdown for the target, and what it should read.
export interface HandoffPackage {
  body: string;
  refs: HandoffRefs;
}
