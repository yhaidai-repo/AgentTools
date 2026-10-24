import { enabledRepos, isAdoActive, readAdoSettings } from "@powerloom/core";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { FocusRow } from "@/components/FocusRow";
import { NoVault } from "@/components/NoVault";
import { Pager } from "@/components/Pager";
import { RememberFilters } from "@/components/RememberFilters";
import { TimeAgo } from "@/components/TimeAgo";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { rememberedParams } from "@/lib/rememberedFilters";
import { countReviewStatuses, matchesReviewStatus } from "@/lib/reviewLooks";
import { REVIEW_LIST_STATUSES, REVIEW_PAGE_SIZES, loadReviewRows } from "@/lib/reviews";
import { reviewsUrl } from "@/lib/reviewsUrl";
import type { ReviewFilter } from "@/models/ReviewFilter";
import type { ReviewRow } from "@/models/ReviewRow";
import { AddReviewForm } from "./AddReviewForm";
import { CheckNowForm } from "./CheckNowForm";
import { ReviewsForm } from "./ReviewsForm";
import { ReviewTable } from "./ReviewTable";
import { GRID_REFRESH_MS } from "@/lib/gridRefresh";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ReviewFilter["status"], string> = { active: "Active", closed: "Closed", all: "All" };

type SearchParams = Promise<{ status?: string; page?: string; size?: string; focus?: string }>;

// Every review of a PR you review in Azure DevOps (user decision 2026-10-02), active ones by default. Nothing is reviewed
// until you start it here.
export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Reviews" />;
  }

  // Coming back from a review only adds `focus`: the remembered filters still apply.
  const { focus, ...asked } = await searchParams;
  const db = getDb();
  const rows = await loadReviewRows(db, vault);
  const filter = filterOf(await rememberedParams("/reviews", asked), Number(focus) || null);
  const shown = rows.filter((row) => matchesReviewStatus(row, filter.status));
  const pages = Math.max(Math.ceil(shown.length / filter.size), 1);
  const page = Math.min(pageOf(shown, filter), pages);
  const adoActive = isAdoActive(await readAdoSettings(db, vault));

  return (
    <>
      <div className="page-head">
        <h1>Reviews</h1>
        <AutoRefresh active intervalMs={GRID_REFRESH_MS} />
      </div>
      <RememberFilters vault={vault} />
      <div className="backlog-bar">
        <StatusPills rows={rows} filter={filter} />
        {adoActive && <AddReviewForm repos={(await enabledRepos(db, vault)).filter((entry) => entry.kind === "ado").map((entry) => ({ name: entry.name, defaultBranch: entry.defaultBranch }))} />}
        {adoActive ? <CheckLine rows={rows} /> : <span className="sync-line">No Azure DevOps integration for {vault}: enable it in <Link href="/settings">Settings</Link> to list pull requests.</span>}
      </div>
      {shown.length === 0 ? <p className="empty-note">No reviews. Check now lists the active PRs where you&apos;re a reviewer or the author; you start each review.</p> : <ReviewsForm><ReviewTable rows={shown.slice((page - 1) * filter.size, page * filter.size)} /></ReviewsForm>}
      {shown.length > 0 && <Pager page={page} size={filter.size} sizes={REVIEW_PAGE_SIZES} pages={pages} total={shown.length} noun="reviews" hrefOf={(change) => reviewsUrl({ status: filter.status, page: change.page, size: change.size ?? filter.size })} />}
      {filter.focus !== null && <FocusRow rowId={`pr-${filter.focus}`} />}
    </>
  );
}

function filterOf(params: Record<string, string | undefined>, focus: number | null): ReviewFilter {
  return {
    status: REVIEW_LIST_STATUSES.find((value) => value === params.status) ?? "active",
    page: Math.max(Number(params.page) || 1, 1),
    size: REVIEW_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : REVIEW_PAGE_SIZES[0],
    focus,
  };
}

// The page that holds the review you came back from, else the page asked for.
function pageOf(shown: ReviewRow[], filter: ReviewFilter): number {
  const index = shown.findIndex((row) => row.pr.id === filter.focus);

  return index < 0 ? filter.page : Math.floor(index / filter.size) + 1;
}

function StatusPills({ rows, filter }: { rows: ReviewRow[]; filter: ReviewFilter }) {
  const counts = countReviewStatuses(rows);

  return (
    <nav className="status-pills" aria-label="Filter by status">
      {REVIEW_LIST_STATUSES.map((status) => (
        <Link key={status} href={reviewsUrl({ status, size: filter.size })} className={status === filter.status ? "status-pill on" : "status-pill"}>
          {STATUS_LABELS[status]} <b>{counts[status]}</b>
        </Link>
      ))}
    </nav>
  );
}

// When PowerLoom last listed your PRs in Azure DevOps, and the button to list them now.
function CheckLine({ rows }: { rows: ReviewRow[] }) {
  const lastChecked = rows.reduce<Date | null>((latest, row) => (latest && latest > row.pr.syncedAt ? latest : row.pr.syncedAt), null);

  return (
    <div className="sync-line">
      <span className="dot ok" />
      <span>PRs checked {lastChecked ? <TimeAgo date={lastChecked} /> : "never"}</span>
      <CheckNowForm />
    </div>
  );
}
