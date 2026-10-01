import type { workItem } from "@adoa/db";

// A Backlog row: the PBI plus how many of its questions and human tasks wait for the user.
export type BacklogRow = typeof workItem.$inferSelect & { openForYou: number };
