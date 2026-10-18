import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import type { ItemDetail } from "@/lib/pbiDetail";
import type { RefinementDetailsView } from "@/models/RefinementDetailsView";
import { DesignSection } from "../pbis/[adoId]/DesignSection";
import { EstimateLine } from "../pbis/[adoId]/EstimateLine";
import { RefinementDetailsLine } from "../pbis/[adoId]/RefinementDetailsLine";

// The result of a refinement, design or code-review task on its own page (user, 2026-10-15), as the PBI and Reviews
// pages show it: the version its runs wrote, or its pull request's review.
export function TaskResults({ detail }: { detail: ItemDetail }) {
  return (
    <>
      <RefinementResult detail={detail} />
      <DesignResult detail={detail} />
      <EstimateResult detail={detail} />
      <ReviewResultCard detail={detail} />
    </>
  );
}

function RefinementResult({ detail }: { detail: ItemDetail }) {
  const result = detail.taskResults.refinement;

  if (!result) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · refinement v{result.version}{result.runId ? ` · RUN-${result.runId}` : ""}</h2>
      <p>{result.summary}</p>
      <RefinementDetailsLine adoId={result.pbiId} details={result.details as RefinementDetailsView | null} />
      <p><Link href={`/pbis/${result.pbiId}`}>PBI-{result.pbiId}</Link> has the latest refinement; the refinement note has every section.</p>
    </section>
  );
}

function DesignResult({ detail }: { detail: ItemDetail }) {
  const result = detail.taskResults.design;

  if (!result) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · design v{result.version}</h2>
      <DesignSection design={result} />
    </section>
  );
}

// The estimate this task's runs recorded; the PBI page shows the PBI's latest from any agent.
function EstimateResult({ detail }: { detail: ItemDetail }) {
  const estimate = detail.taskResults.estimate;

  if (!estimate) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · estimate</h2>
      <EstimateLine estimate={estimate} />
      <p><Link href={`/pbis/${estimate.pbiId}`}>PBI-{estimate.pbiId}</Link> shows its latest estimate from any agent.</p>
    </section>
  );
}

function ReviewResultCard({ detail }: { detail: ItemDetail }) {
  const result = detail.taskResults.review;

  if (!result) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · review of PR {result.prId}</h2>
      <p>{result.comments} comment(s), {result.open} open · <Link href={`/reviews/${result.prId}`}>open the review</Link></p>
      {result.summary && <MarkdownBlock text={result.summary} />}
    </section>
  );
}
