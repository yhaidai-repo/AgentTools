import type { GsdSeed } from "@agenttools/runtime";

const ORCHESTRATOR_MODEL = "claude-opus-5-5";
const FAN_OUT_MODEL = "claude-haiku-5-5";

// The file the agent starts GSD from (/gsd-new-project --auto @.planning/PBI.md); written again on every run, so a run
// after answered questions plans from the answers.
export const PBI_CONTEXT_FILE = "PBI.md";

// Model per GSD sub-agent (user decision 2026-10-29): Opus 5.5 where the plan is decided and checked, Haiku 5.5 for the
// mapping and research fan-out. The orchestrator is the PowerLoom agent's own model. Full ids, so GSD's tiers can't move
// them to another model.
const MODEL_OVERRIDES: Record<string, string> = {
  "gsd-planner": ORCHESTRATOR_MODEL,
  "gsd-plan-checker": ORCHESTRATOR_MODEL,
  "gsd-roadmapper": ORCHESTRATOR_MODEL,
  "gsd-codebase-mapper": FAN_OUT_MODEL,
  "gsd-pattern-mapper": FAN_OUT_MODEL,
  "gsd-phase-researcher": FAN_OUT_MODEL,
  "gsd-project-researcher": FAN_OUT_MODEL,
  "gsd-research-synthesizer": FAN_OUT_MODEL,
  "gsd-assumptions-analyzer": FAN_OUT_MODEL,
};

// Unattended planning: yolo and coarse phases, the plan checker on, no auto-advance into execution, questions as text
// (the run has no AskUserQuestion) and no background planner watch loop, which ended the spike's turns while it waited.
const PLANNING_CONFIG: Record<string, unknown> = {
  mode: "yolo",
  granularity: "coarse",
  model_profile: "adaptive",
  model_overrides: MODEL_OVERRIDES,
  commit_docs: false,
  workflow: { research: true, plan_check: true, auto_advance: false, text_mode: true, skip_discuss: false },
  planner: { stall_detection_enabled: false },
};

// What the runner writes into the PBI worktree's .planning/ before the run's first GSD command.
export function planningSeed(pbiContext: string): GsdSeed {
  return { config: PLANNING_CONFIG, files: [{ path: PBI_CONTEXT_FILE, content: pbiContext }] };
}
