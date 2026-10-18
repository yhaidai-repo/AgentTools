import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import type { PbiDetail } from "@/lib/pbiDetail";

type Design = NonNullable<PbiDetail["design"]>;

// The latest design: approach, plan, alternatives, risks, tests. Estimates are their own section (record_estimate).
export function DesignSection({ design }: { design: PbiDetail["design"] }) {
  if (!design) {
    return <p className="muted">Not designed yet.</p>;
  }

  return (
    <>
      <p className="muted">v{design.version}{design.runId ? <>, <Link href={`/agents/runs/${design.runId}`}>RUN-{design.runId}</Link></> : null}</p>
      <MarkdownBlock text={design.approach} />
      <h3>Plan</h3>
      <PlanTable design={design} />
      <Bullets title="Alternatives" items={design.alternatives.map((item) => `${item.option}: pros ${item.pros.join("; ") || "none"}; cons ${item.cons.join("; ") || "none"}. Not chosen: ${item.whyNot}`)} />
      <Bullets title="Risks" items={design.risks.map((item) => `${item.risk} (${item.impact}) → ${item.mitigation}`)} />
      <Bullets title="Tests" items={design.tests.map((item) => `${item.kind}: ${item.case}`)} />
      <Bullets title="Assumptions" items={design.assumptions} />
    </>
  );
}

function PlanTable({ design }: { design: Design }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Step</th><th>Repo</th><th>Where</th><th>Change</th><th>Agent</th></tr>
        </thead>
        <tbody>
          {design.plan.map((step, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{step.step}</td>
              <td>{step.repo}</td>
              <td>{step.locations.join(", ")}</td>
              <td>{step.change}</td>
              <td>{step.agentDoable ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h3>{title}</h3>
      <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </>
  );
}
