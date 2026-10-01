import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import type { CloseDecision, CloseItemRequest } from "./models/CloseItemRequest";
import type { ItemStatus } from "./models/ItemStatus";
import type { Outcome } from "./models/Outcome";
import { setItemStatus } from "./pbiStatus";
import { extractUrls } from "./urls";

type ItemRow = typeof localItem.$inferSelect;

const CLOSABLE_STATUSES: ItemStatus[] = ["open", "in-progress"];

// Which decisions each human item kind takes, and the status each one leads to.
const DECISIONS: Record<string, Partial<Record<CloseDecision, ItemStatus>>> = {
  question: { answer: "answered", dismiss: "dismissed" },
  human: { done: "done", cancel: "cancelled" },
};

// Checks the request before anything is stored, so a rejected request leaves no upload behind.
export async function findClosableItem(db: AdoaDb, request: CloseItemRequest): Promise<Outcome<ItemRow>> {
  const [item] = await db.select().from(localItem).where(and(eq(localItem.id, request.itemId), eq(localItem.pbiId, request.adoId)));

  if (!item || item.assignee !== "human") {
    return { ok: false, error: `${request.itemId} is not a question or human task of PBI-${request.adoId}.` };
  }

  if (!CLOSABLE_STATUSES.includes(item.status)) {
    return { ok: false, error: `${item.id} is already ${item.status}.` };
  }

  if (!DECISIONS[item.kind]?.[request.decision]) {
    return { ok: false, error: `"${request.decision}" doesn't apply to a ${item.kind}.` };
  }

  if (request.decision === "answer" && !request.resolution && !request.hasAttachment) {
    return { ok: false, error: "Write an answer or attach a file." };
  }

  return { ok: true, value: item };
}

// Closes an item checked by findClosableItem; status_history records the person as the actor.
export async function closeHumanItem(db: AdoaDb, item: ItemRow, request: CloseItemRequest): Promise<ItemStatus> {
  const status = DECISIONS[item.kind][request.decision]!;

  await db.update(localItem).set({ resolution: request.resolution }).where(eq(localItem.id, item.id));
  await setItemStatus(db, item.id, item.status, status, "human");

  return status;
}

// The linked document a question asks for: stored by the refinement guard, or the only URL in older questions.
export function linkedUrlOf(item: ItemRow): string | null {
  const stored = (item.data as { url?: string } | null)?.url;
  const urls = extractUrls(item.body ?? "");

  return stored ?? (urls.length === 1 ? urls[0] : null);
}
