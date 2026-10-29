import { enabledRepos, isAdoActive, isGitHubActive, readAdoSettings, readGitHubSettings } from "@powerloom/core";
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
import { countReviewStatuses, matchesReviewSearch, matchesReviewStatus } from "@/lib/reviewLooks";
import { REVIEW_LIST_STATUSES, REVIEW_PAGE_SIZES, loadReviewRows } from "@/lib/reviews";
import { reviewsUrl } from "@/lib/reviewsUrl";
import type { ReviewFilter } from "@/models/ReviewFilter";
import type { ReviewRow } from "@/models/ReviewRow";
import { AddLocalReviewForm } from "./AddLocalReviewForm";
import { AddReviewForm } from "./AddReviewForm";
import { CheckNowForm } from "./CheckNowForm";
import { ReviewsForm } from "./ReviewsForm";
import { ReviewTable } from "./ReviewTable";
import { GRID_REFRESH_MS } from "@/lib/gridRefresh";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ReviewFilter["status"], string> = { active: "Active", closed: "Closed", all: "All" };

type SearchParams = Promise<{ status?: string; q?: string; page?: string; size?: string; focus?: string }>;

// Every review of a PR you review in Azure DevOps (user decision 2026-10-02), and of local repos' branches without it
// (user decision 2026-10-25), active ones by default. Nothing is reviewed until you start it here.
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
  const found = rows.filter((row) => matchesReviewSearch(row, filter.search));
  const shown = found.filter((row) => matchesReviewStatus(row, filter.status));
  const pages = Math.max(Math.ceil(shown.length / filter.size), 1);
  const page = Math.min(pageOf(shown, filter), pages);
  const adoActive = isAdoActive(await readAdoSettings(db, vault));
  const gitHubActive = isGitHubActive(await readGitHubSettings(db, vault));
  const repos = (await enabledRepos(db, vault)).map((entry) => ({ kind: entry.kind, name: entry.name, defaultBranch: entry.defaultBranch }));
  const localRepos = repos.filter((entry) => entry.kind === "local");

  return (
    <>
      <div className="page-head">
        <h1>Reviews</h1>
        <AutoRefresh active intervalMs={GRID_REFRESH_MS} />
        <div className="page-action head-actions">
          {adoActive && <AddReviewForm repos={repos.filter((entry) => entry.kind === "ado")} />}
          {localRepos.length > 0 && <AddLocalReviewForm repos={localRepos} />}
        </div>
      </div>
      <RememberFilters vault={vault} />
      <div className="backlog-bar">
        <StatusPills rows={found} filter={filter} />
        <div className="bar-right">
          <SearchField filter={filter} />
          {adoActive || gitHubActive ? <CheckLine rows={rows} /> : <NoAdoLine vault={vault} hasLocalRepos={localRepos.length > 0} />}
        </div>
      </div>
      {shown.length === 0 ? <p className="empty-note">{filter.search ? `No review matches "${filter.search}".` : "No reviews. Check now lists the active PRs where you&apos;re a reviewer or the author; you start each review."}</p> : <ReviewsForm><ReviewTable rows={shown.slice((page - 1) * filter.size, page * filter.size)} /></ReviewsForm>}
      {shown.length > 0 && <Pager page={page} size={filter.size} sizes={REVIEW_PAGE_SIZES} pages={pages} total={shown.length} noun="reviews" hrefOf={(change) => reviewsUrl({ status: filter.status, search: filter.search, page: change.page, size: change.size ?? filter.size })} />}
      {filter.focus !== null && <FocusRow rowId={`pr-${filter.focus}`} />}
    </>
  );
}

// Without Azure DevOps or GitHub there are no pull requests to list, but a local repo's branches can still be reviewed.
function NoAdoLine({ vault, hasLocalRepos }: { vault: string; hasLocalRepos: boolean }) {
  return (
    <span className="sync-line">
      No Azure DevOps or GitHub for {vault}: connect one in <Link href="/settings">Settings</Link> to list pull requests.
      {!hasLocalRepos && <> Local reviews need a local repo: add one in <Link href="/settings?tab=repos">Settings → Repositories</Link>.</>}
    </span>
  );
}

function filterOf(params: Record<string, string | undefined>, focus: number | null): ReviewFilter {
  return {
    status: REVIEW_LIST_STATUSES.find((value) => value === params.status) ?? "active",
    page: Math.max(Number(params.page) || 1, 1),
    size: REVIEW_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : REVIEW_PAGE_SIZES[0],
    focus,
    search: (params.q ?? "").trim(),
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
        <Link key={status} href={reviewsUrl({ status, search: filter.search, size: filter.size })} className={status === filter.status ? "status-pill on" : "status-pill"}>
          {STATUS_LABELS[status]} <b>{counts[status]}</b>
        </Link>
      ))}
    </nav>
  );
}

// Finds reviews by words of the title, a PR number or a PBI number; applies on Enter, the status stays.
function SearchField({ filter }: { filter: ReviewFilter }) {
  return (
    <form method="get" action="/reviews" className="pbi-filter">
      <input type="hidden" name="status" value={filter.status} />
      <input name="q" type="search" defaultValue={filter.search} placeholder="Search title, PR or PBI number" aria-label="Search reviews" size={28} />
    </form>
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
