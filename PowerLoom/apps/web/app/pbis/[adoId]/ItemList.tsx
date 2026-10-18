import Link from "next/link";
import { isOpen, itemPath } from "@/lib/items";
import type { ItemRow } from "@/lib/pbiDetail";

interface ItemListProps {
  items: ItemRow[];
  empty: string;
  /** Results of the listed tasks (research results); shown inside their task, not as rows of their own. */
  results?: ItemRow[];
}

// Status rows, open items first, each linking to its page with the full content (and the answer form): what waits on
// you pulses amber, an agent task in progress pulses cyan, what is done stays quiet (user decision 2026-10-18).
export function ItemList({ items, empty, results = [] }: ItemListProps) {
  if (items.length === 0) {
    return <p className="empty">{empty}</p>;
  }

  const sorted = [...items].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));

  return (
    <div className="item-rows">
      {sorted.map((item) => (
        <div key={item.id} className="item-row">
          <span className={dotClass(item)} />
          <Link href={itemPath(item)} className="id">{item.id}</Link>
          <span className="item-title" title={item.title}>{item.title}</span>
          <span className="item-state">{stateText(item)}<ResultNote result={latestResult(item, results)} /></span>
          <HeldNote item={item} />
        </div>
      ))}
    </div>
  );
}

function dotClass(item: ItemRow): string {
  if (!isOpen(item)) {
    return "dot";
  }

  if (item.assignee === "human") {
    return "dot warn";
  }

  return item.status === "in-progress" ? "dot running" : "dot ok";
}

function stateText(item: ItemRow): string {
  if (isOpen(item) && item.assignee === "human") {
    return "waits for you";
  }

  return (item.data as { needsWeb?: boolean } | null)?.needsWeb ? `${item.status} · needs web` : item.status;
}

// The task's current result: the final one, else the newest.
function latestResult(task: ItemRow, results: ItemRow[]): ItemRow | null {
  const own = results.filter((result) => result.parentId === task.id);

  return own.find((result) => result.status === "final") ?? own.at(-1) ?? null;
}

// Why the dispatcher hasn't started this agent task yet (its last check).
function HeldNote({ item }: { item: ItemRow }) {
  if (item.status !== "open" || item.heldBy.length === 0) {
    return null;
  }

  return <span className="item-held">held: {item.heldBy.join("; ")}</span>;
}

function ResultNote({ result }: { result: ItemRow | null }) {
  if (!result) {
    return null;
  }

  const confidence = (result.data as { confidence?: string } | null)?.confidence;

  return <> · result{confidence ? `: ${confidence} confidence` : ""}</>;
}
