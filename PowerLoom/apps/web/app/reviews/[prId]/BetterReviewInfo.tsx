import Link from "next/link";
import type { BetterReviewDetails } from "@/models/BetterReviewDetails";

// Better Review's last run beyond its summary: how it was anchored, the rules it added to the repo's review rules note,
// and the research tasks it created. Nothing for Code review's reviews (no details).
export function BetterReviewInfo({ details }: { details: object | null }) {
  if (!isBetterReview(details)) {
    return null;
  }

  return (
    <section>
      <p className="muted">
        {details.mode.kind === "follow-up" ? <>Follow-up review: what changed since commit {details.mode.baseCommit.slice(0, 8)}.</> : <>Full review ({details.mode.reason}).</>}
        {details.researchTaskIds.length > 0 && <> Research asked: {details.researchTaskIds.map((id) => <Link key={id} className="chip" href={`/tasks/${id}`}>{id}</Link>)}</>}
      </p>
      {details.rules.length > 0 && (
        <>
          <h3>Review rules added</h3>
          <ul>
            {details.rules.map((rule, index) => <li key={rule.id ?? index}><strong>{rule.id ?? "not saved"}</strong> ({rule.kind}) {rule.rule} <span className="muted">· {rule.appliesTo} · {rule.source}</span></li>)}
          </ul>
          <p className="muted">{details.rulesSaved ? <>In the vault's <code>{details.rulesPath}</code>; edit or retire them there.</> : <>The agent-runner couldn't write the vault, so they aren't in <code>{details.rulesPath}</code> yet.</>}</p>
        </>
      )}
    </section>
  );
}

function isBetterReview(details: object | null): details is BetterReviewDetails {
  return details !== null && (details as { agent?: string }).agent === "better-review";
}
