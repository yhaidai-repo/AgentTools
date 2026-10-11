import Link from "next/link";
import { isOpen, itemPath } from "@/lib/items";
import type { ItemRow } from "@/lib/pbiDetail";

interface ItemListProps {
  items: ItemRow[];
  empty: string;
  /** Results of the listed tasks (research results); shown inside their task, not as rows of their own. */
  results?: ItemRow[];
}

// Short list: open items first, each linking to its page with the full content (and the answer form).
export function ItemList({ items, empty, results = [] }: ItemListProps) {
  if (items.length === 0) {
    return <p className="muted">{empty}</p>;
  }

  const sorted = [...items].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));

  return (
    <ul className="item-list">
      {sorted.map((item) => (
        <li key={item.id}>
          <Link href={itemPath(item)}>{item.id}</Link>
          {" · "}
          <span className={isOpen(item) && item.assignee === "human" ? "result-error" : "muted"}>{item.status}</span>
          {" · "}
          {item.title}
          {(item.data as { needsWeb?: boolean } | null)?.needsWeb && <span className="chip"> needs web</span>}
          <ResultNote result={latestResult(item, results)} />
          <HeldNote item={item} />
        </li>
      ))}
    </ul>
  );
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

  return <span className="result-error"> · held: {item.heldBy.join("; ")}</span>;
}

function ResultNote({ result }: { result: ItemRow | null }) {
  if (!result) {
    return null;
  }

  const confidence = (result.data as { confidence?: string } | null)?.confidence;

  return <span className="muted"> · result{confidence ? `: ${confidence} confidence` : ""}</span>;
}
