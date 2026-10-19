import Link from "next/link";

// Pages shown on each side of the current one; the first and last always show, the rest fold into "…".
const NEAR = 2;

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
        {shownPages(page, pages).map((number, index) => (number === null ? <span key={`gap-${index}`} className="pager-gap">…</span> : <PageLink key={number} href={hrefOf({ page: number, size })} label={String(number)} current={number === page} />))}
        <PageLink href={hrefOf({ page: page + 1, size })} label="›" disabled={page >= pages} />
      </span>
      <span className="pager-size">
        Per page
        {sizes.map((choice) => <Link key={choice} href={hrefOf({ size: choice })} className={choice === size ? "pager-button on" : "pager-button"}>{choice}</Link>)}
      </span>
    </div>
  );
}

// The page numbers to show, null where pages fold: 1 … 4 5 [6] 7 8 … 43.
function shownPages(page: number, pages: number): (number | null)[] {
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).filter((number) => number === 1 || number === pages || Math.abs(number - page) <= NEAR);

  return numbers.flatMap((number, index) => (index > 0 && number - numbers[index - 1] > 1 ? [null, number] : [number]));
}

function PageLink({ href, label, current = false, disabled = false }: { href: string; label: string; current?: boolean; disabled?: boolean }) {
  if (disabled) {
    return <span className="pager-button disabled">{label}</span>;
  }

  return <Link href={href} className={current ? "pager-button on" : "pager-button"} aria-current={current ? "page" : undefined}>{label}</Link>;
}
