import type { BuildContent, BuildDeviation, BuildPlan, BuildPlanStatus, HandOverState, OpenUatItem, PhaseVerification } from "@powerloom/db";
import { inspectProblem } from "../planning/readPlan";
import { frontmatterField } from "../planning/planFileSections";
import type { InspectPhase } from "../planning/models/InspectPhase";
import type { InspectPlan } from "../planning/models/InspectPlan";
import type { InspectUatItem } from "../planning/models/InspectUatItem";
import type { PlanningFolder } from "../planning/models/PlanningFolder";
import type { PlanningInspect } from "../planning/models/PlanningInspect";
import { summaryDeviations, summaryOneLiner, verificationTruths } from "./buildFileSections";
import type { BuildPlace } from "./models/BuildPlace";
import type { BuildReading } from "./models/BuildReading";
import type { BuildSource } from "./models/BuildSource";
import type { ReportedBuild } from "./models/ReportedBuild";

const DONE_TASK_STATUSES = ["done", "complete", "completed"];
const ACCEPTED_VERIFICATIONS = ["passed", "human_needed"];
const MISSING_VERIFICATION = "missing";

// One phase's build as its files left it.
interface PhaseBuild {
  plans: BuildPlan[];
  deviations: BuildDeviation[];
  verification: PhaseVerification;
  uat: OpenUatItem[];
}

// The build as GSD and git left it: inspect gives each plan's progress, the verifier's status and the open UAT tests;
// each SUMMARY.md its one-liner and deviations; each VERIFICATION.md its score and truths; git the branch's commits. The
// agent adds only what no file holds (ReportedBuild).
export async function readBuild(source: BuildSource, place: BuildPlace, reported: ReportedBuild): Promise<BuildReading> {
  const inspect = await source.planning.inspect();
  const problem = inspectProblem(inspect);

  if (problem) {
    return { ok: false, problem };
  }

  const phases = await Promise.all(((inspect as PlanningInspect).phases ?? []).map((phase) => readPhase(source.planning, phase)));
  const plans = phases.flatMap((phase) => phase.plans);

  if (plans.length === 0) {
    return { ok: false, problem: "planning inspect lists no plan: there is nothing built to record" };
  }

  return { ok: true, content: await contentOf(source, place, reported, phases), inspect };
}

async function contentOf(source: BuildSource, place: BuildPlace, reported: ReportedBuild, phases: PhaseBuild[]): Promise<BuildContent> {
  const plans = phases.flatMap((phase) => phase.plans);
  const verification = phases.map((phase) => phase.verification);
  const uat = phases.flatMap((phase) => phase.uat);

  return {
    summary: reported.summary,
    planVersion: place.planVersion,
    repo: place.repo,
    branch: place.branch,
    baseBranch: place.baseBranch,
    worktree: place.worktree,
    headSha: await source.head(),
    commands: place.commands,
    plans,
    commits: await source.commits(place.baseBranch),
    deviations: phases.flatMap((phase) => phase.deviations),
    checkpoints: reported.checkpoints,
    verification,
    uat,
    handOver: { state: handOverState(plans, verification, uat), verdict: reported.verdict, prTitle: reported.prTitle, itemId: null },
  };
}

async function readPhase(folder: PlanningFolder, phase: InspectPhase): Promise<PhaseBuild> {
  const current = (phase.plans ?? []).filter((plan) => !plan.superseded);
  const summaries = await Promise.all(current.map(async (plan) => (await folder.read(`phases/${phase.dir}/${summaryFile(plan)}`)) ?? ""));
  const verification = (await folder.read(`phases/${phase.dir}/${phase.phase_id}-VERIFICATION.md`)) ?? "";

  return {
    plans: current.map((plan, index) => buildPlan(phase.phase_id, plan, summaries[index])),
    deviations: current.flatMap((plan, index) => summaryDeviations(summaries[index], plan.id)),
    verification: phaseVerification(phase, verification),
    uat: (phase.uat?.unresolved ?? []).map((item) => uatItem(phase.phase_id, item)),
  };
}

// The plan's SUMMARY.md sits beside its PLAN.md: 01-02-PLAN.md → 01-02-SUMMARY.md.
function summaryFile(plan: InspectPlan): string {
  return plan.file.replace(/-PLAN\.md$/i, "-SUMMARY.md");
}

function buildPlan(phase: string, plan: InspectPlan, summary: string): BuildPlan {
  const tasks = plan.tasks ?? [];
  const tasksDone = plan.hasSummary ? tasks.length : tasks.filter((task) => DONE_TASK_STATUSES.includes((task.status ?? "").toLowerCase())).length;

  return {
    id: plan.id,
    phase,
    wave: plan.wave ?? 1,
    objective: plan.objective ?? "",
    status: planStatus(plan, tasksDone),
    tasksDone,
    tasksTotal: tasks.length,
    changedFiles: plan.changedFiles ?? [],
    oneLiner: summaryOneLiner(summary),
  };
}

function planStatus(plan: InspectPlan, tasksDone: number): BuildPlanStatus {
  if (plan.hasSummary) {
    return "done";
  }

  return tasksDone > 0 ? "partial" : "pending";
}

// The verifier's report wins over inspect's status; a phase without either was never verified.
function phaseVerification(phase: InspectPhase, report: string): PhaseVerification {
  const status = frontmatterField(report, "status") || phase.verification?.status || MISSING_VERIFICATION;

  return { phase: phase.phase_id, status, score: frontmatterField(report, "score"), truths: verificationTruths(report) };
}

function uatItem(phase: string, item: InspectUatItem): OpenUatItem {
  return { phase, test: String(item.test ?? ""), name: item.name ?? "", result: item.result ?? "", reason: item.reason ?? "" };
}

// Gaps when a plan isn't done or a phase's verification failed or never ran; a person's tests left when the verifier
// needs a human or UAT tests are open; ready otherwise.
function handOverState(plans: BuildPlan[], verification: PhaseVerification[], uat: OpenUatItem[]): HandOverState {
  const hasGaps = plans.some((plan) => plan.status !== "done") || verification.some((phase) => !ACCEPTED_VERIFICATIONS.includes(phase.status));

  if (hasGaps) {
    return "gaps";
  }

  return uat.length > 0 || verification.some((phase) => phase.status === "human_needed") ? "needs-person" : "ready";
}
