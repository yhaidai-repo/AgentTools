import type { reviewComment } from "@powerloom/db";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NoVault } from "@/components/NoVault";
import { Panel } from "@/components/Panel";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { versionKey } from "@/lib/resultLinks";
import { loadReviewResultSet } from "@/lib/resultVersions";
import { loadReviewDetail } from "@/lib/reviews";
import type { ResultVersion } from "@/models/ResultVersion";
import type { ReviewDetail } from "@/models/ReviewDetail";
import { ResultBlock } from "../../results/ResultBlock";
import { BetterReviewInfo } from "./BetterReviewInfo";
import { CommentCard } from "./CommentCard";
import { ReviewHeader } from "./ReviewHeader";
import { ReviewRuns } from "./ReviewRuns";

export const dynamic = "force-dynamic";

const REFRESH_MS = 5_000;

type CommentRow = typeof reviewComment.$inferSelect;

// The review's summary is the chosen review version (user decision 2026-10-21: every run kept, the latest shown).
export default async function ReviewPage({ params, searchParams }: { params: Promise<{ prId: string }>; searchParams: Promise<{ v?: string }> }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Reviews" />;
  }

  const detail = await loadReviewDetail(getDb(), Number((await params).prId), vault);

  if (!detail) {
    notFound();
  }

  const isBusy = detail.state === "queued" || detail.state === "reviewing";
  const reviews = await loadReviewResultSet(detail.pr.id);
  const hrefOf = (version: ResultVersion) => `/reviews/${detail.pr.id}?v=${encodeURIComponent(versionKey(version))}`;

  return (
    <>
      <AutoRefresh active={isBusy} intervalMs={REFRESH_MS} />
      <ReviewHeader detail={detail} />
      <div className="pbi-columns review-columns">
        <div>
          <Panel title="Summary" aside={reviews.versions.length > 1 ? <small>{reviews.versions.length} versions</small> : null}>
            <ResultBlock set={reviews} chosen={(await searchParams).v} hrefOf={hrefOf} />
          </Panel>
          <Comments detail={detail} />
        </div>
        <div>
          <ReviewRuns detail={detail} />
          <BetterReviewInfo details={detail.review.details ?? null} />
        </div>
      </div>
    </>
  );
}

function Comments({ detail }: { detail: ReviewDetail }) {
  const { open, total } = detail.comments;

  return (
    <Panel title="Comments" aside={<small>{open} open · {total} in all</small>}>
      {detail.allComments.length === 0 && <p className="hint">No comments.</p>}
      {groupByFile(detail.allComments).map(([file, comments]) => <FileComments key={file} file={file} comments={comments} />)}
    </Panel>
  );
}

function FileComments({ file, comments }: { file: string; comments: CommentRow[] }) {
  return (
    <section className="comment-file">
      <div className="comment-file-head">{file}<span>{comments.length} comment{comments.length === 1 ? "" : "s"}</span></div>
      {comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)}
    </section>
  );
}

function groupByFile(comments: CommentRow[]): [string, CommentRow[]][] {
  const byFile = new Map<string, CommentRow[]>();

  comments.forEach((comment) => byFile.set(comment.filePath, [...(byFile.get(comment.filePath) ?? []), comment]));

  return [...byFile];
}
