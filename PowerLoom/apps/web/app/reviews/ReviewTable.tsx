import Link from "next/link";
import { AdoTag } from "@/components/AdoTag";
import { SelectAll } from "@/components/SelectAll";
import { TimeAgo } from "@/components/TimeAgo";
import { personName } from "@/lib/personName";
import { branchName, isReviewClosed, reviewNeedsYou } from "@/lib/reviewLooks";
import type { ReviewRow } from "@/models/ReviewRow";
import { NewPushesMark, ReviewStatePill } from "./ReviewBadges";

// Four columns that fit (user, 2026-10-18: no sideways scroll): the facts of a PR go on a quiet line under its title.
// A review that needs you has an amber edge; a closed one is dimmed.
export function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  return (
    <div className="panel review-table">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-select"><SelectAll name="prId" /></th>
            <th className="col-id">PR</th>
            <th>Pull request</th>
            <th className="col-state">Review</th>
            <th className="col-comments num" title="Open comments / all comments">Open / all</th>
            <th className="col-updated num">Reviewed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <ReviewRowView key={row.pr.id} row={row} />)}
        </tbody>
      </table>
    </div>
  );
}

function ReviewRowView({ row }: { row: ReviewRow }) {
  const { pr } = row;
  const classes = [reviewNeedsYou(row) ? "needs-you" : "", isReviewClosed(row) ? "settled" : ""].filter(Boolean).join(" ");

  return (
    <tr id={`pr-${pr.id}`} className={classes || undefined}>
      <td className="col-select"><input type="checkbox" name="prId" value={pr.id} aria-label={`Select ${pr.id}`} /></td>
      <td className="col-id"><Link href={`/reviews/${pr.id}`} className="id" title={pr.origin === "pc" ? "A branch only on this PC: tested, not code-reviewed until pushed" : pr.origin === "local" ? "A branch review: no pull request" : undefined}>{pr.origin === "local" || pr.origin === "pc" ? "branch" : pr.id}</Link><AdoTag url={pr.url} /></td>
      <td className="title">
        <Link href={`/reviews/${pr.id}`} className="row-title" title={pr.title}>{pr.title}</Link>
        <div className="row-facts">
          <span>{pr.repoName}</span>
          {pr.author && <span>{personName(pr.author)}</span>}
          <span className="branch">→ {branchName(pr.targetRef)}</span>
          {pr.workItemIds.map((id) => <Link key={id} href={`/pbis/${id}`}>PBI-{id}</Link>)}
          <span>opened <TimeAgo date={pr.adoCreatedAt} /></span>
          {pr.isDraft && <span className="draft-tag">draft</span>}
        </div>
      </td>
      <td className="col-state"><ReviewStatePill row={row} /><NewPushesMark row={row} /></td>
      <td className="col-comments num"><CommentCounts row={row} /></td>
      <td className="col-updated num"><TimeAgo date={row.review.reviewedAt} /></td>
    </tr>
  );
}

// Open comments in amber, the answered ones in the tooltip.
function CommentCounts({ row }: { row: ReviewRow }) {
  const { open, answered, total } = row.comments;

  if (row.review.reviewedAt === null) {
    return <span className="muted">–</span>;
  }

  return <span title={`${answered} answered`}>{open > 0 ? <b className="text-warn">{open}</b> : <span className="muted">0</span>} / {total}</span>;
}
