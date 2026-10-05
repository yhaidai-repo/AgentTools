import { hasItemChat } from "@adoa/core";
import { ContinueChat } from "@/components/ContinueChat";
import { isOpen } from "@/lib/items";
import type { ItemRow } from "@/lib/pbiDetail";

// Open questions, human tasks and findings only (user decision 2026-10-05); the item's status doesn't change.
export function ContinueItem({ item }: { item: ItemRow }) {
  return hasItemChat(item.kind) && isOpen(item) ? <ContinueChat target={{ kind: "item", itemId: item.id }} /> : null;
}
