import { sourceLabel, type HumanTaskData, type HumanTaskStep } from "@powerloom/core";
import { CopyButton } from "@/components/CopyButton";
import { MarkdownText } from "@/components/MarkdownText";

const QUERY_LANGUAGES: Record<string, string> = { kql: "KQL", "cosmos-sql": "Cosmos SQL", sql: "SQL" };

// A structured human task (user decision 2026-10-05): why a person must do it and what it solves first, then each step
// with its resource, the query ready to copy, and what to report back. While the task is open the steps live in the
// answer form instead, one card per step with its answer field (user decision 2026-10-18), so they show once. Agents write
// these fields as markdown, so they show formatted (user report 2026-10-25: raw symbols and lost line breaks).
export function HumanTaskContent({ data, withSteps }: { data: HumanTaskData; withSteps: boolean }) {
  return (
    <>
      <h2>Why</h2>
      <MarkdownText text={data.why} />
      <h2>Solves</h2>
      <MarkdownText text={data.solves} />
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
      <MarkdownText text={step.action} className="step-action" />
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
      <MarkdownText text={`**Report back:** ${step.reportBack}`} />
    </>
  );
}
