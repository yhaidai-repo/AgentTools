import type { localItem } from "@powerloom/db";

// A Tasks page row: the local item with every run that worked on it, newest first (questions and findings have none).
export type TaskRow = typeof localItem.$inferSelect & {
  runs: { id: number; outcome: string }[];
};
