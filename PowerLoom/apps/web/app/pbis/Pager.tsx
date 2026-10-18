import Link from "next/link";
import { backlogUrl } from "@/lib/backlogUrl";
import { PAGE_SIZES } from "@/lib/backlogPages";
import type { BacklogView } from "@/models/BacklogView";

// Under the table: which PBIs the page shows, the pages, and how many a page holds. The page lives in the URL, so the
// Live refresh keeps it.
export function Pager({ view, total, pages }: { view: BacklogView; total: number; pages: number }) {
  const from = total === 0 ? 0 : (view.page - 1) * view.size + 1;
  const to = Math.min(view.page * view.size, total);

  return (
    <div className="pager">
      <span className="pager-info">{from}–{to} of {total} PBIs</span>
      <span className="pager-pages">
        <PageLink view={view} page={view.page - 1} label="‹" disabled={view.page <= 1} />
        {Array.from({ length: pages }, (_, index) => index + 1).map((page) => <PageLink key={page} view={view} page={page} label={String(page)} current={page === view.page} />)}
        <PageLink view={view} page={view.page + 1} label="›" disabled={view.page >= pages} />
      </span>
      <span className="pager-size">
        Per page
        {PAGE_SIZES.map((size) => <Link key={size} href={backlogUrl({ statuses: view.statuses, size })} className={size === view.size ? "pager-button on" : "pager-button"}>{size}</Link>)}
      </span>
    </div>
  );
}

function PageLink({ view, page, label, current = false, disabled = false }: { view: BacklogView; page: number; label: string; current?: boolean; disabled?: boolean }) {
  if (disabled) {
    return <span className="pager-button disabled">{label}</span>;
  }

  return <Link href={backlogUrl({ statuses: view.statuses, size: view.size, page })} className={current ? "pager-button on" : "pager-button"} aria-current={current ? "page" : undefined}>{label}</Link>;
}
