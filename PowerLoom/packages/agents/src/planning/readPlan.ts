import type { PhasePlan, PlanContent, PlanRequirement } from "@powerloom/db";
import { autoChoices, contextDecisions } from "./discussFiles";
import type { InspectPhase } from "./models/InspectPhase";
import type { InspectPlan } from "./models/InspectPlan";
import type { PlanReading } from "./models/PlanReading";
import type { PlanningFolder } from "./models/PlanningFolder";
import type { PlanningInspect } from "./models/PlanningInspect";
import type { ReportedPlan } from "./models/ReportedPlan";
import { bullets, flaggedAssumptions, frontmatterRequirements, taggedSection, threatRegister } from "./planFileSections";

// The only `planning inspect` layout this reader knows (GSD Core 1.19.0); another one is refused, never guessed at.
export const INSPECT_SCHEMA_VERSION = 1;

// One phase's plan files with the text each was read from.
interface PhaseFiles {
  phase: InspectPhase;
  plans: { plan: InspectPlan; text: string }[];
  context: string;
  discussionLog: string;
}

// The plan as GSD left it in .planning/: inspect gives the phases, plans, waves, tasks and requirements; CONTEXT.md the
// decisions; DISCUSSION-LOG.md what --auto chose alone; each PLAN.md its requirements, checks, risks and flagged
// assumptions. The agent adds only what no file holds (ReportedPlan).
export async function readPlan(folder: PlanningFolder, reported: ReportedPlan): Promise<PlanReading> {
  const inspect = await folder.inspect();
  const problem = inspectProblem(inspect);

  if (problem) {
    return { ok: false, problem };
  }

  const snapshot = inspect as PlanningInspect;
  const phases = await Promise.all((snapshot.phases ?? []).map((phase) => readPhase(folder, phase)));
  const plans = phases.flatMap(phasePlans);

  if (plans.length === 0) {
    return { ok: false, problem: "planning inspect lists no plan yet: run /gsd-plan-phase for each roadmap phase first" };
  }

  return { ok: true, content: contentOf(phases, plans, snapshot, reported), inspect };
}

// Why an inspect snapshot can't be read (no object, another schema_version), or null when it can.
export function inspectProblem(inspect: unknown): string | null {
  if (typeof inspect !== "object" || inspect === null) {
    return "planning inspect returned no JSON object";
  }

  const version = (inspect as { schema_version?: unknown }).schema_version;

  return version === INSPECT_SCHEMA_VERSION ? null : `planning inspect schema_version ${String(version)} is not supported (only ${INSPECT_SCHEMA_VERSION})`;
}

async function readPhase(folder: PlanningFolder, phase: InspectPhase): Promise<PhaseFiles> {
  const current = (phase.plans ?? []).filter((plan) => !plan.superseded);
  const plans = await Promise.all(current.map(async (plan) => ({ plan, text: (await folder.read(`phases/${phase.dir}/${plan.file}`)) ?? "" })));
  const context = (await folder.read(`phases/${phase.dir}/${phase.phase_id}-CONTEXT.md`)) ?? "";
  const discussionLog = (await folder.read(`phases/${phase.dir}/${phase.phase_id}-DISCUSSION-LOG.md`)) ?? "";

  return { phase, plans, context, discussionLog };
}

function contentOf(phases: PhaseFiles[], plans: PhasePlan[], snapshot: PlanningInspect, reported: ReportedPlan): PlanContent {
  const planTexts = phases.flatMap((phase) => phase.plans);

  return {
    summary: reported.summary,
    decisions: phases.flatMap((phase) => contextDecisions(phase.context, phase.phase.phase_id)),
    autoChoices: phases.flatMap((phase) => autoChoices(phase.discussionLog, phase.phase.phase_id)),
    requirements: requirementCoverage(snapshot, plans),
    plans,
    checker: reported.checker,
    risks: planTexts.flatMap(({ plan, text }) => threatRegister(text, plan.id)),
    assumptions: [...reported.assumptions, ...planTexts.flatMap(({ text }) => flaggedAssumptions(text))],
  };
}

function phasePlans(phase: PhaseFiles): PhasePlan[] {
  return phase.plans.map(({ plan, text }) => ({
    id: plan.id,
    phase: phase.phase.phase_id,
    wave: plan.wave ?? 1,
    objective: plan.objective ?? "",
    dependsOn: plan.dependsOn ?? [],
    autonomous: plan.autonomous ?? true,
    requirements: frontmatterRequirements(text),
    tasks: (plan.tasks ?? []).map((task) => ({ name: task.name, type: task.type ?? "auto", files: task.plannedFiles ?? [], done: task.done ?? "", status: task.status ?? "pending" })),
    tests: bullets(taggedSection(text, "verification")),
  }));
}

// Every requirement with the plans that name it; one no plan names is the gap the review must see.
function requirementCoverage(snapshot: PlanningInspect, plans: PhasePlan[]): PlanRequirement[] {
  return (snapshot.requirements ?? []).map((requirement) => ({
    id: requirement.id,
    text: requirement.text,
    complete: requirement.complete,
    plans: plans.filter((plan) => plan.requirements.includes(requirement.id)).map((plan) => plan.id),
  }));
}
