import Link from "next/link";
import { Panel } from "@/components/Panel";
import type { BetterReviewDetails } from "@/models/BetterReviewDetails";

// Better Review's last run beyond its summary, in the side column: the rules it added to the repo's review rules note,
// and the research tasks it created (its mode is a fact in the header). Nothing for Code review's reviews (no details).
export function BetterReviewInfo({ details }: { details: object | null }) {
  const better = betterReviewOf(details);

  if (!better) {
    return null;
  }

  return (
    <>
      {better.rules.length > 0 && <RulesPanel details={better} />}
      {better.researchTaskIds.length > 0 && (
        <Panel title="Research asked">
          <div className="chip-list">{better.researchTaskIds.map((id) => <Link key={id} className="chip" href={`/tasks/${id}`}>{id}</Link>)}</div>
        </Panel>
      )}
    </>
  );
}

function RulesPanel({ details }: { details: BetterReviewDetails }) {
  return (
    <Panel title="Review rules added" aside={<small>{details.rulesSaved ? "in the vault" : "not saved yet"}</small>}>
      {details.rules.map((rule, index) => (
        <div key={rule.id ?? index} className="review-rule">
          {rule.rule}
          <small>{rule.id ?? "not saved"} · {rule.kind} · {rule.appliesTo} · {rule.source}</small>
        </div>
      ))}
      <p className="hint">{details.rulesSaved ? <>Edit or retire them in <code>{details.rulesPath}</code>.</> : <>The agent-runner couldn&apos;t write the vault, so they aren&apos;t in <code>{details.rulesPath}</code> yet.</>}</p>
    </Panel>
  );
}

export function betterReviewOf(details: object | null): BetterReviewDetails | null {
  return details !== null && (details as { agent?: string }).agent === "better-review" ? (details as BetterReviewDetails) : null;
}
