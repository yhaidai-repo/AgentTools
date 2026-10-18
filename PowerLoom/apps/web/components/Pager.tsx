import Link from "next/link";

interface PagerProps {
  page: number;
  size: number;
  sizes: number[];
  pages: number;
  total: number;
  /** What is counted, e.g. "PBIs", "tasks". */
  noun: string;
  /** The page's address for another page or page size; the list keeps its filters. */
  hrefOf: (change: { page?: number; size?: number }) => string;
}

// Under a list: which items the page shows, the pages, and how many a page holds. The page lives in the URL, so the
// Live refresh keeps it.
export function Pager({ page, size, sizes, pages, total, noun, hrefOf }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="pager">
      <span className="pager-info">{from}–{to} of {total} {noun}</span>
      <span className="pager-pages">
        <PageLink href={hrefOf({ page: page - 1, size })} label="‹" disabled={page <= 1} />
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <PageLink key={number} href={hrefOf({ page: number, size })} label={String(number)} current={number === page} />)}
        <PageLink href={hrefOf({ page: page + 1, size })} label="›" disabled={page >= pages} />
      </span>
      <span className="pager-size">
        Per page
        {sizes.map((choice) => <Link key={choice} href={hrefOf({ size: choice })} className={choice === size ? "pager-button on" : "pager-button"}>{choice}</Link>)}
      </span>
    </div>
  );
}

function PageLink({ href, label, current = false, disabled = false }: { href: string; label: string; current?: boolean; disabled?: boolean }) {
  if (disabled) {
    return <span className="pager-button disabled">{label}</span>;
  }

  return <Link href={href} className={current ? "pager-button on" : "pager-button"} aria-current={current ? "page" : undefined}>{label}</Link>;
}
