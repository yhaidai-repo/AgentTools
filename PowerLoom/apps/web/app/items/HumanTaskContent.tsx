import { sourceLabel, type HumanTaskData, type HumanTaskStep } from "@powerloom/core";
import { CopyButton } from "@/components/CopyButton";

const QUERY_LANGUAGES: Record<string, string> = { kql: "KQL", "cosmos-sql": "Cosmos SQL", sql: "SQL" };

// A structured human task (user decision 2026-10-05): why a person must do it and what it solves first, then each step
// with its resource, the query ready to copy, and what to report back.
export function HumanTaskContent({ data }: { data: HumanTaskData }) {
  return (
    <>
      <h2>Why</h2>
      <p>{data.why}</p>
      <h2>Solves</h2>
      <p>{data.solves}</p>
      <h2>Steps</h2>
      <ol className="human-steps">
        {data.steps.map((step, index) => <li key={index}><StepView step={step} /></li>)}
      </ol>
    </>
  );
}

function StepView({ step }: { step: HumanTaskStep }) {
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
