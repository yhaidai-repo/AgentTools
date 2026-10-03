import type { reviewComment } from "@adoa/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { getDb } from "@/lib/db";
import { loadReviewDetail } from "@/lib/reviews";
import type { ReviewDetail } from "@/models/ReviewDetail";
import { LinkedPbis } from "../LinkedPbis";
import { ReviewBadges } from "../ReviewBadges";
import { CommentCard } from "./CommentCard";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

const REFRESH_MS = 5_000;

type CommentRow = typeof reviewComment.$inferSelect;

export default async function ReviewPage({ params }: { params: Promise<{ prId: string }> }) {
  const detail = await loadReviewDetail(getDb(), Number((await params).prId));

  if (!detail) {
    notFound();
  }

  const { pr, review } = detail;
  const isBusy = detail.state === "queued" || detail.state === "reviewing";

  return (
    <>
      <p><Link href="/reviews">← Reviews</Link></p>
      <h1>PR {pr.id} · {pr.title}</h1>
      <div className="chips">
        <AutoRefresh active={isBusy} intervalMs={REFRESH_MS} />
        <ReviewBadges row={detail} />
        <a className="chip" href={pr.url} target="_blank" rel="noreferrer">Open in Azure DevOps</a>
      </div>
      <p className="muted">
        {pr.repoName} · {pr.sourceRef.replace(/^refs\/heads\//, "")} → {pr.targetRef.replace(/^refs\/heads\//, "")} · by {pr.author ?? "–"} · PBIs <LinkedPbis ids={pr.workItemIds} />
      </p>
      <ReviewActions prId={pr.id} isClosed={review.status === "closed"} state={detail.state} hasBeenReviewed={review.reviewedAt !== null} />
      <NewCommitsNotice detail={detail} />
      {review.status === "closed" && <p className="muted">Closed{review.closedReason ? `: ${review.closedReason}` : ""}. Starting a review reopens it.</p>}
      <h2>Summary</h2>
      {review.summaryMd ? <MarkdownBlock text={review.summaryMd} /> : <p className="muted">Not reviewed yet.</p>}
      <p className="muted">
        Reviewed commit {review.reviewedCommit?.slice(0, 8) ?? "–"}, <LocalTime date={review.reviewedAt} />. Runs:{" "}
        {detail.runs.length === 0 ? "none" : detail.runs.map((run) => <Link key={run.id} className="chip" href={`/agents/runs/${run.id}`}>RUN-{run.id} · {run.outcome}</Link>)}
      </p>
      <h2>Comments ({detail.comments.open} open / {detail.comments.total})</h2>
      {detail.allComments.length === 0 ? <p className="muted">No comments.</p> : groupByFile(detail.allComments).map(([file, comments]) => <FileComments key={file} file={file} comments={comments} />)}
    </>
  );
}

// The PR moved past the reviewed commit: nothing re-reviews it on its own (user decision 2026-10-02).
function NewCommitsNotice({ detail }: { detail: ReviewDetail }) {
  if (!detail.hasNewCommits) {
    return null;
  }

  const pushes = detail.newPushes ? `${detail.newPushes} push${detail.newPushes === 1 ? "" : "es"}` : "New commits";

  return <p className="result-error">{pushes} since this review (latest commit {detail.pr.sourceCommit.slice(0, 8)}, seen <LocalTime date={detail.pr.syncedAt} />). Rerun review to review them.</p>;
}

function FileComments({ file, comments }: { file: string; comments: CommentRow[] }) {
  return (
    <section>
      <h3><code>{file}</code></h3>
      {comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)}
    </section>
  );
}

function groupByFile(comments: CommentRow[]): [string, CommentRow[]][] {
  const byFile = new Map<string, CommentRow[]>();

  comments.forEach((comment) => byFile.set(comment.filePath, [...(byFile.get(comment.filePath) ?? []), comment]));

  return [...byFile];
}
