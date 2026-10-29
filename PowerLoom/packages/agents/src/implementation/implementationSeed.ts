import type { GsdSeed } from "@agenttools/runtime";
import type { BuildCommands } from "@powerloom/db";
import type { ImplementationModels } from "./models/ImplementationModels";

const OPUS = "claude-opus-5-5";
const FAN_OUT_MODEL = "claude-haiku-5-5";

// Models of GSD's execution (user decision 2026-10-29): Opus 5.5 executes and verifies, Haiku 5.5 maps the code. The
// executor model stays a per-run value, so a later trial can run executors on another model without a code change.
export const DEFAULT_IMPLEMENTATION_MODELS: ImplementationModels = { executor: OPUS, verifier: OPUS };

const EXECUTION_AGENTS = ["gsd-executor", "gsd-code-fixer", "gsd-debugger"];
const VERIFICATION_AGENTS = ["gsd-verifier", "gsd-code-reviewer", "gsd-integration-checker"];
const MAPPING_AGENTS = ["gsd-codebase-mapper", "gsd-pattern-mapper"];

// The run's models: the defaults, with what the task's `data.gsdModels` sets instead.
export function implementationModels(taskData: unknown): ImplementationModels {
  const chosen = (taskData as { gsdModels?: Partial<Record<keyof ImplementationModels, unknown>> } | null)?.gsdModels ?? {};

  return {
    executor: typeof chosen.executor === "string" && chosen.executor ? chosen.executor : DEFAULT_IMPLEMENTATION_MODELS.executor,
    verifier: typeof chosen.verifier === "string" && chosen.verifier ? chosen.verifier : DEFAULT_IMPLEMENTATION_MODELS.verifier,
  };
}

// What the runner merges into the PBI worktree's .planning/config.json before the run: unattended execution in the
// run's own worktree (no executor worktrees, which the spike's runtime didn't isolate anyway), no auto-advance, the
// verifier on, questions as text, commit_docs off, and the repo's build and test commands from the vault's settings.
// The planning run's keys stay (the preparer merges one level deep).
export function implementationSeed(models: ImplementationModels, commands: BuildCommands): GsdSeed {
  return {
    config: {
      mode: "yolo",
      model_overrides: modelOverrides(models),
      commit_docs: false,
      workflow: { auto_advance: false, text_mode: true, use_worktrees: false, verifier: true, ...commandKeys(commands) },
    },
    files: [],
  };
}

function modelOverrides(models: ImplementationModels): Record<string, string> {
  return Object.fromEntries([
    ...EXECUTION_AGENTS.map((agent) => [agent, models.executor]),
    ...VERIFICATION_AGENTS.map((agent) => [agent, models.verifier]),
    ...MAPPING_AGENTS.map((agent) => [agent, FAN_OUT_MODEL]),
  ]);
}

// GSD's own keys for the commands; an unset command leaves GSD's default. The worktree's shell routes each to the sandbox
// as it is, so a configured command stays one command (or `cd <folder> && <command>`).
function commandKeys(commands: BuildCommands): Record<string, string> {
  const keys: Record<string, string> = {};

  if (commands.build) {
    keys.build_command = commands.build;
  }

  if (commands.test) {
    keys.test_command = commands.test;
  }

  return keys;
}
