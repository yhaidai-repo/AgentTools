import { sourceLabel, type HumanTaskData, type HumanTaskStep } from "@powerloom/core";
import { CopyButton } from "@/components/CopyButton";

const QUERY_LANGUAGES: Record<string, string> = { kql: "KQL", "cosmos-sql": "Cosmos SQL", sql: "SQL" };

// A structured human task (user decision 2026-10-05): why a person must do it and what it solves first, then each step
// with its resource, the query ready to copy, and what to report back. While the task is open the steps live in the
// answer form instead, one card per step with its answer field (user decision 2026-10-18), so they show once.
export function HumanTaskContent({ data, withSteps }: { data: HumanTaskData; withSteps: boolean }) {
  return (
    <>
      <h2>Why</h2>
      <p>{data.why}</p>
      <h2>Solves</h2>
      <p>{data.solves}</p>
      {withSteps && <h2>Steps</h2>}
      {withSteps && (
        <ol className="human-steps">
          {data.steps.map((step, index) => <li key={index}><StepView step={step} /></li>)}
        </ol>
      )}
    </>
  );
}

export function StepView({ step }: { step: HumanTaskStep }) {
  return (
    <>
      <p><strong>{step.action}</strong></p>
      <p className="muted">{sourceLabel(step.source)}: {step.resource}{step.timeRange ? ` · ${step.timeRange}` : ""}</p>
      {step.query && (
        <div className="query-block">
          <div className="actions">
            <span className="chip">{QUERY_LANGUAGES[step.query.language] ?? step.query.language}</span>
            <CopyButton text={step.query.text} />
          </div>
          <pre><code>{step.query.text}</code></pre>
        </div>
      )}
      <p>Report back: {step.reportBack}</p>
    </>
  );
}
