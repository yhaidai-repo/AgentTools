import type { workItem } from "@adoa/db";

// A Backlog row: the PBI plus how many of its questions and human tasks wait for the user.
// openForYou: open items of the user that hold the agents back; findingsToReview: open findings, which don't.
export type BacklogRow = typeof workItem.$inferSelect & { openForYou: number; findingsToReview: number };
