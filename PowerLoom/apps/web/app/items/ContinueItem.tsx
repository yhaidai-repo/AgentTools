import { agentIdOf } from "@powerloom/core";
import { ContinueChat } from "@/components/ContinueChat";
import { isOpen } from "@/lib/items";
import type { ItemRow } from "@/lib/pbiDetail";

// Open questions, human tasks and findings (user decision 2026-10-05), and every agent task whatever its status (user
// decision 2026-10-16); the item's status doesn't change.
const CHAT_KINDS = ["question", "human", "finding"];

export function ContinueItem({ item }: { item: ItemRow }) {
  return hasChat(item) ? <ContinueChat target={{ kind: "item", itemId: item.id }} /> : null;
}

function hasChat(item: ItemRow): boolean {
  if (agentIdOf(item.assignee) !== null) {
    return true;
  }

  return CHAT_KINDS.includes(item.kind) && isOpen(item);
}
