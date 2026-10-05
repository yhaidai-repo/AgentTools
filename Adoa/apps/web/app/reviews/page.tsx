import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import { RememberFilters } from "@/components/RememberFilters";
import { TimeAgo } from "@/components/TimeAgo";
import { getDb } from "@/lib/db";
import { rememberedParams } from "@/lib/rememberedFilters";
import { REVIEW_LIST_STATUSES, loadReviewRows, type ReviewListStatus } from "@/lib/reviews";
import type { ReviewRow } from "@/models/ReviewRow";
import { CheckNowForm } from "./CheckNowForm";
import { LinkedPbis } from "./LinkedPbis";
import { QueueReviewButton } from "./QueueReviewButton";
import { ReviewBadges } from "./ReviewBadges";
import { ReviewStatusFilter } from "./ReviewStatusFilter";

export const dynamic = "force-dynamic";

const REFRESH_MS = 15_000;

type SearchParams = Promise<{ status?: string }>;

// Every review of a PR you review in Azure DevOps (user decision 2026-10-02), active ones by default. Nothing is reviewed
// until you start it here.
export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await rememberedParams("/reviews", await searchParams);
  const status: ReviewListStatus = REVIEW_LIST_STATUSES.find((value) => value === params.status) ?? "active";
  const rows = await loadReviewRows(getDb(), status);

  return (
    <>
      <h1>Reviews</h1>
      <RememberFilters />
      <div className="chips">
        <AutoRefresh active intervalMs={REFRESH_MS} />
      </div>
      <div className="toolbar">
        <ReviewStatusFilter key={status} status={status} statuses={REVIEW_LIST_STATUSES} />
        <CheckNowForm />
      </div>
      {rows.length === 0 ? <p className="muted">No reviews. Check now lists the active PRs where you&apos;re a reviewer; you start each review.</p> : <ReviewTable rows={rows} />}
    </>
  );
}

function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Created</th>
            <th>PR</th>
            <th>Title</th>
            <th>Repo</th>
            <th>Author</th>
            <th>Target</th>
            <th>PBIs</th>
            <th>Review</th>
            <th>Comments</th>
            <th>Reviewed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pr.id}>
              <td><TimeAgo date={row.pr.adoCreatedAt} /></td>
              <td><a href={row.pr.url} target="_blank" rel="noreferrer">{row.pr.id}</a></td>
              <td><Link href={`/reviews/${row.pr.id}`}>{row.pr.title}</Link>{row.pr.isDraft && <span className="muted"> · draft</span>}</td>
              <td>{row.pr.repoName}</td>
              <td>{row.pr.author ?? "–"}</td>
              <td>{row.pr.targetRef.replace(/^refs\/heads\//, "")}</td>
              <td><LinkedPbis ids={row.pr.workItemIds} /></td>
              <td><ReviewBadges row={row} /></td>
              <td title="open / total, answered">{row.comments.open} / {row.comments.total}{row.comments.answered > 0 && <span className="muted"> · {row.comments.answered} answered</span>}</td>
              <td><LocalTime date={row.review.reviewedAt} /></td>
              <td><QueueReviewButton prId={row.pr.id} state={row.state} hasBeenReviewed={row.review.reviewedAt !== null} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
