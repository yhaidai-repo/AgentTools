import type { BuildContent, BuildPlan, PhaseVerification } from "@powerloom/db";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { TitledList } from "@/components/TitledList";

const STATES: Record<BuildContent["handOver"]["state"], string> = { ready: "ready", "needs-person": "needs a person's tests", gaps: "has gaps" };

// One implementation version (the implementation agent's write_implementation): the summary, where the branch is and
// its hand-over, each plan's progress, the verification matrix, the open UAT items, commits, deviations and checkpoints.
export function BuildSection({ build }: { build: BuildContent }) {
  return (
    <>
      <MarkdownBlock text={build.summary} />
      <p><strong>Hand-over:</strong> {STATES[build.handOver.state]}{build.handOver.itemId ? ` (${build.handOver.itemId})` : ""}: {build.handOver.verdict}</p>
      <p><strong>Branch:</strong> <code>{build.branch}</code> in {build.repo} from <code>{build.baseBranch}</code>, head <code>{build.headSha ?? "-"}</code>, not pushed</p>
      <p><strong>Worktree:</strong> <code>{build.worktree}</code></p>
      <p><strong>Pull request:</strong> {build.handOver.prTitle}</p>
      <PlanTable plans={build.plans} />
      {build.verification.map((phase) => <VerificationTable key={phase.phase} phase={phase} />)}
      <TitledList title="Open UAT items" items={build.uat.map((item) => `Phase ${item.phase}, test ${item.test}: ${item.name} (${item.result}${item.reason ? `: ${item.reason}` : ""})`)} />
      <TitledList title="Checkpoints" items={build.checkpoints.map((item) => `${item.plan}: ${item.text} → ${item.resolution}`)} />
      <TitledList title="Deviations" items={build.deviations.map((item) => `${item.plan}: ${item.text}`)} />
      <TitledList title="Commits" items={build.commits.map((commit) => `${commit.sha.slice(0, 8)} ${commit.message}`)} />
      <TitledList title="Commands" items={[...(build.commands.build ? [`build: ${build.commands.build}`] : []), ...(build.commands.test ? [`test: ${build.commands.test}`] : [])]} />
    </>
  );
}

function PlanTable({ plans }: { plans: BuildPlan[] }) {
  return (
    <>
      <h3>Plans</h3>
      <div className="table-wrap">
        <table className="plan-table">
          <thead>
            <tr><th>Plan</th><th>Wave</th><th>Status</th><th>Tasks</th><th>Delivered</th></tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.id}</td>
                <td>{plan.wave}</td>
                <td>{plan.status}</td>
                <td>{plan.tasksDone}/{plan.tasksTotal}</td>
                <td>{plan.oneLiner || plan.objective}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VerificationTable({ phase }: { phase: PhaseVerification }) {
  return (
    <>
      <h3>Verification, phase {phase.phase}: {phase.status}{phase.score ? ` (${phase.score})` : ""}</h3>
      {phase.truths.length > 0 && (
        <div className="table-wrap">
          <table className="plan-table">
            <thead>
              <tr><th>Truth</th><th>Status</th><th>Evidence</th></tr>
            </thead>
            <tbody>
              {phase.truths.map((truth, index) => (
                <tr key={index}>
                  <td>{truth.truth}</td>
                  <td>{truth.status}</td>
                  <td>{truth.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
