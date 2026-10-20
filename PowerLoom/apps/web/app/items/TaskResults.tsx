import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import type { ItemDetail } from "@/lib/pbiDetail";

// A code-review task's result on its own page (user, 2026-10-15): its pull request's review. Only the latest review of a
// pull request is stored, so it has no versions; the other results are TaskResultSets.
export function TaskResults({ detail }: { detail: ItemDetail }) {
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
