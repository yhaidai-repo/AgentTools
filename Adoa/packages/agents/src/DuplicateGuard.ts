import { textSimilarity } from "@adoa/core";
import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray } from "drizzle-orm";
import type { KnownItem } from "./models/KnownItem";

// Only near-identical text is rejected: reworded duplicates can't be told from new questions by words (see
// textSimilarity); the agents get the PBI's existing items in the first message for those.
const DUPLICATE_SIMILARITY = 0.8;
const CHECKED_KINDS = ["question", "research", "human"];

// The create tools ask this before noting a new question or task; a rejection names the existing item so the agent
// can use it instead (user decision 2026-10-01: no duplicates, also on reruns).
export class DuplicateGuard {
  private constructor(private readonly known: KnownItem[]) {}

  static async load(db: AdoaDb, adoId: number): Promise<DuplicateGuard> {
    const rows = await db
      .select({ id: localItem.id, kind: localItem.kind, status: localItem.status, body: localItem.body, title: localItem.title })
      .from(localItem)
      .where(and(eq(localItem.pbiId, adoId), inArray(localItem.kind, CHECKED_KINDS as (typeof localItem.$inferSelect.kind)[])));

    return new DuplicateGuard(rows.map((row) => ({ id: row.id, kind: row.kind, status: row.status, text: row.body ?? row.title })));
  }

  // The rejection message, or null when the text is new.
  check(kind: string, text: string): string | null {
    const match = this.known.find((item) => item.kind === kind && textSimilarity(item.text, text) >= DUPLICATE_SIMILARITY);

    if (!match) {
      return null;
    }

    const advice = match.status === "deleted" ? "The user deleted it: don't create it again." : `Use ${match.id} instead of creating a new one.`;

    return `Not created: it repeats ${match.id} (${match.status}): "${match.text.slice(0, 160)}". ${advice}`;
  }

  // Items noted earlier in this run count too, so the agent can't create the same one twice in one run.
  remember(kind: string, label: string, text: string): void {
    this.known.push({ id: label, kind, status: "created in this run", text });
  }
}
