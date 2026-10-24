import type { HumanTaskData } from "@powerloom/core";

// A question or task the design agent creates for the user. Only for the user: research has the same code and docs
// as design, so design looks things up itself (user decision 2026-10-02).
export interface GapItem {
  kind: "question" | "task";
  title: string;
  text: string;
  why: string;
  options: string[];
  /** A task's structured steps (user decision 2026-10-05); null for questions. */
  humanTask: HumanTaskData | null;
}
