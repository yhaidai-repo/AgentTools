import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import type { ReviewRunResult } from "@/models/ReviewRunResult";
import { gistOf } from "../reviews/[prId]/CommentCard";

// One review run: the summary it gave (kept since 2026-10-21) and the comments it left, each a link to its card on the
// review page, where it is answered.
export function ReviewBody({ review }: { review: ReviewRunResult }) {
  return (
    <>
      <ReviewSummary review={review} />
      <h3>Comments from this run</h3>
      {review.comments.length === 0 ? <p className="muted">None.</p> : <RunComments review={review} />}
    </>
  );
}

function ReviewSummary({ review }: { review: ReviewRunResult }) {
  if (review.version?.summaryMd) {
    return <MarkdownBlock text={review.version.summaryMd} />;
  }

  return <p className="muted">{review.version ? "This run gave no summary." : "This run's summary wasn't kept: until 2026-10-21 a review kept only its latest."}</p>;
}

function RunComments({ review }: { review: ReviewRunResult }) {
  return (
    <ul className="run-comments">
      {review.comments.map((comment) => (
        <li key={comment.id}>
          <Link href={`/reviews/${review.prId}#${comment.id}`} className="id">{comment.id}</Link>
          <span className="severity">{comment.severity}</span>
          <span className={`comment-status status-${comment.status}`}>{comment.status}</span>
          <span className="comment-where">{comment.filePath}:{comment.startLine}</span>
          <span>{gistOf(comment.bodyMd)}</span>
        </li>
      ))}
    </ul>
  );
}
