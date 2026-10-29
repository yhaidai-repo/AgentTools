import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContinueChat } from "@/components/ContinueChat";
import { HeroStat } from "@/components/HeroStat";
import { RunWatch } from "@/components/RunWatch";
import { RunningStrip } from "@/components/RunningStrip";
import { TimeAgo } from "@/components/TimeAgo";
import { formatUsd } from "@/lib/format";
import { personName } from "@/lib/personName";
import { branchName, isReviewClosed, reviewHeading } from "@/lib/reviewLooks";
import { reviewsUrl } from "@/lib/reviewsUrl";
import type { BetterReviewDetails } from "@/models/BetterReviewDetails";
import type { ReviewDetail } from "@/models/ReviewDetail";
import { PrSiteTag } from "../PrSiteTag";
import { QueueReviewButton } from "../QueueReviewButton";
import { NewPushesMark, ReviewStatePill, newPushesLabel } from "../ReviewBadges";
import { betterReviewOf } from "./BetterReviewInfo";
import { ReviewMoreActions } from "./ReviewMoreActions";

// A review's header, like the PBI page's (user decision 2026-10-18): where it sits, what it is and its state, one
// primary action, its facts, four numbers, the agent reviewing now, and a calm note when the PR moved on.
export function ReviewHeader({ detail }: { detail: ReviewDetail }) {
  const { pr, review } = detail;
  const running = detail.runs.find(({ run }) => run.outcome === "running")?.run ?? null;

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Reviews", href: reviewsUrl({ status: isReviewClosed(detail) ? "closed" : "active", focus: pr.id }) }, { label: `PR ${pr.id}` }]} />
      <section className="pbi-hero">
        <RunWatch />
        <div className="hero-top">
          <div className="hero-title">
            <div className="hero-id"><span className="id">{reviewHeading(pr)}</span><PrSiteTag url={pr.url} origin={pr.origin} /><ReviewStatePill row={detail} /><NewPushesMark row={detail} /></div>
            <h1 className="item-title-head">{pr.title}</h1>
          </div>
          <div className="hero-actions">
            <QueueReviewButton prId={pr.id} state={detail.state} hasBeenReviewed={review.reviewedAt !== null} />
            {!isReviewClosed(detail) && <ContinueChat target={{ kind: "review", prId: pr.id }} />}
            <ReviewMoreActions prId={pr.id} isClosed={isReviewClosed(detail)} />
          </div>
        </div>
        <Facts detail={detail} />
        <Stats detail={detail} />
        {isReviewClosed(detail) && <p className="review-note">Closed{review.closedReason ? `: ${review.closedReason}` : ""}. Starting a review reopens it.</p>}
        {detail.hasNewCommits && <NewPushesBanner detail={detail} />}
        {running && <RunningStrip run={running} itemHref={running.itemId ? `/tasks/${running.itemId}` : null} />}
      </section>
    </>
  );
}

function Facts({ detail }: { detail: ReviewDetail }) {
  const { pr, review } = detail;
  const better = betterReviewOf(review.details ?? null);

  return (
    <div className="hero-facts">
      <Fact label="Repo">{pr.repoName}</Fact>
      <Fact label="Branch"><span className="mono">{branchName(pr.sourceRef)} → {branchName(pr.targetRef)}</span></Fact>
      {pr.author && <Fact label="Author">{personName(pr.author)}</Fact>}
      {pr.workItemIds.map((id) => <Fact key={id} label="PBI"><Link href={`/pbis/${id}`}>PBI-{id}</Link></Fact>)}
      <Fact label="Reviewed"><span className="mono">{review.reviewedCommit ? <>{review.reviewedCommit.slice(0, 8)} · <TimeAgo date={review.reviewedAt} /></> : "not yet"}</span></Fact>
      {better && <Fact label="Mode">{modeText(better)}</Fact>}
      {pr.isDraft && <span className="draft-tag">draft</span>}
    </div>
  );
}

function modeText(details: BetterReviewDetails): string {
  return details.mode.kind === "follow-up" ? `follow-up since ${details.mode.baseCommit.slice(0, 8)}` : `full (${details.mode.reason})`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <span className="fact"><b>{label}</b>{children}</span>;
}

// Open comments breathe amber while you have some to answer.
function Stats({ detail }: { detail: ReviewDetail }) {
  const fixed = detail.allComments.filter((comment) => comment.status === "fixed").length;
  const costUsd = detail.runs.reduce((sum, row) => sum + (row.usage?.costUsd ?? 0), 0);

  return (
    <div className="hero-stats item-stats">
      <HeroStat label="Open comments" value={String(detail.comments.open)} tone={detail.comments.open > 0 ? "warn" : undefined} />
      <HeroStat label="Comments" value={String(detail.comments.total)} note={fixed > 0 ? `${fixed} fixed` : undefined} />
      <HeroStat label="Runs" value={String(detail.runs.length)} />
      <HeroStat label="Cost" value={formatUsd(costUsd, detail.runs.every((row) => row.usage?.accountingComplete !== false))} />
    </div>
  );
}

// The PR moved past the reviewed commit: nothing re-reviews it on its own (user decision 2026-10-02), so the rerun sits
// right in the note.
function NewPushesBanner({ detail }: { detail: ReviewDetail }) {
  const { pr, review } = detail;

  return (
    <div className="new-pushes-banner">
      <span className="dot warn" />
      <span className="banner-what"><b>{newPushesLabel(detail.newPushes)} since this review.</b> <span className="mono">latest {pr.sourceCommit.slice(0, 8)} · seen <TimeAgo date={pr.syncedAt} /></span></span>
      <QueueReviewButton prId={pr.id} state={detail.state} hasBeenReviewed={review.reviewedAt !== null} />
    </div>
  );
}
