import type { PhasePlan, PlanContent } from "@powerloom/db";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { TitledList } from "@/components/TitledList";

const VERDICTS: Record<PlanContent["checker"]["verdict"], string> = { passed: "passed", issues: "issues found", "not-run": "not run" };

// One plan version (the planning agent's write_plan): the summary, the plans by wave with their tasks, the decisions and
// what GSD chose alone, requirements coverage, the plan checker's verdict, risks, tests and assumptions.
export function PlanSection({ plan }: { plan: PlanContent }) {
  return (
    <>
      <MarkdownBlock text={plan.summary} />
      <p><strong>Plan checker:</strong> {VERDICTS[plan.checker.verdict]}</p>
      <TitledList title="Checker issues" items={plan.checker.issues} />
      {waves(plan.plans).map(([wave, plans]) => <WaveTable key={wave} wave={wave} plans={plans} />)}
      <TitledList title="Requirements" items={plan.requirements.map((item) => `${item.id}: ${item.text} → ${item.plans.join(", ") || "not covered"}`)} />
      <TitledList title="Decisions" items={plan.decisions.map((item) => `${item.id} (phase ${item.phase}): ${item.text}`)} />
      <TitledList title="Chosen by GSD alone" items={plan.autoChoices.map((item) => `${item.area} (phase ${item.phase}): ${item.choice}`)} />
      <TitledList title="Risks" items={plan.risks.map((item) => `${item.id} ${item.category}, ${item.component} (${item.severity}, ${item.disposition}) → ${item.mitigation}`)} />
      <TitledList title="Tests" items={plan.plans.flatMap((item) => item.tests.map((test) => `${item.id}: ${test}`))} />
      <TitledList title="Assumptions" items={plan.assumptions} />
    </>
  );
}

function waves(plans: PhasePlan[]): [number, PhasePlan[]][] {
  const byWave = new Map<number, PhasePlan[]>();

  for (const plan of plans) {
    byWave.set(plan.wave, [...(byWave.get(plan.wave) ?? []), plan]);
  }

  return [...byWave].sort(([left], [right]) => left - right);
}

function WaveTable({ wave, plans }: { wave: number; plans: PhasePlan[] }) {
  return (
    <>
      <h3>Wave {wave}</h3>
      <div className="table-wrap">
        <table className="plan-table">
          <thead>
            <tr><th>Plan</th><th>Objective</th><th>Tasks</th><th>Requirements</th><th>After</th></tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.id}</td>
                <td>{plan.objective}</td>
                <td><TaskList plan={plan} /></td>
                <td>{plan.requirements.join(", ")}</td>
                <td>{plan.dependsOn.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TaskList({ plan }: { plan: PhasePlan }) {
  return <ul>{plan.tasks.map((task, index) => <li key={index}>{task.name} <small>({task.type}, {task.status})</small></li>)}</ul>;
}
