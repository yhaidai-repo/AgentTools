import Link from "next/link";

// The work items a PR links: each opens its adoa PBI page (the page says when adoa doesn't have it).
export function LinkedPbis({ ids }: { ids: number[] }) {
  if (ids.length === 0) {
    return <span className="muted">–</span>;
  }

  return <span className="chips">{ids.map((id) => <Link key={id} className="chip" href={`/pbis/${id}`}>PBI-{id}</Link>)}</span>;
}
