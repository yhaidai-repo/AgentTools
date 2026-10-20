import { MarkdownBlock } from "@/components/MarkdownBlock";
import { TitledList } from "@/components/TitledList";
import type { PbiDetail } from "@/lib/pbiDetail";

type Design = NonNullable<PbiDetail["design"]>;

// One design version: approach, plan, alternatives, risks, tests. Estimates are their own section (record_estimate).
export function DesignSection({ design }: { design: PbiDetail["design"] }) {
  if (!design) {
    return <p className="muted">Not designed yet.</p>;
  }

  return (
    <>
      <MarkdownBlock text={design.approach} />
      <h3>Plan</h3>
      <PlanTable design={design} />
      <TitledList title="Alternatives" items={design.alternatives.map((item) => `${item.option}: pros ${item.pros.join("; ") || "none"}; cons ${item.cons.join("; ") || "none"}. Not chosen: ${item.whyNot}`)} />
      <TitledList title="Risks" items={design.risks.map((item) => `${item.risk} (${item.impact}) → ${item.mitigation}`)} />
      <TitledList title="Tests" items={design.tests.map((item) => `${item.kind}: ${item.case}`)} />
      <TitledList title="Assumptions" items={design.assumptions} />
    </>
  );
}

function PlanTable({ design }: { design: Design }) {
  return (
    <div className="table-wrap">
      <table className="plan-table">
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
