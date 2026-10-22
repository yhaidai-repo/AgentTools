import type { ResultEvidence, runResult } from "@powerloom/db";
import { MarkdownBlock } from "@/components/MarkdownBlock";

type RunResultRow = typeof runResult.$inferSelect;

// What one run wrote with write_result: its body (Markdown, the first line its summary), the evidence behind it, and
// the structured data its prompt asked for, folded since it repeats the body in the agent's own shape.
export function RunResultBody({ row }: { row: RunResultRow }) {
  return (
    <>
      <MarkdownBlock text={row.body} />
      <h3>Evidence</h3>
      <EvidenceList evidence={row.evidence ?? []} />
      {row.data && <DataFold data={row.data} />}
    </>
  );
}

function EvidenceList({ evidence }: { evidence: ResultEvidence[] }) {
  if (evidence.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <ul className="run-result-evidence">
      {evidence.map((entry, index) => (
        <li key={index}>
          <span className="mono">{entry.ref}</span>
          <span>{entry.note}</span>
          {entry.quote && <blockquote>{entry.quote}</blockquote>}
        </li>
      ))}
    </ul>
  );
}

function DataFold({ data }: { data: object }) {
  return (
    <details className="fold-panel run-result-data">
      <summary><span className="fold-mark" aria-hidden="true">›</span>Data</summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
