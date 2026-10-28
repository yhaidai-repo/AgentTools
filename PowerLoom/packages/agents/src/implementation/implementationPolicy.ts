import type { ToolPolicy, ToolPolicyCall, ToolPolicyDecision } from "@agenttools/runtime";
import { writeTarget } from "../planning/planningDocsOnly";

const RUN_CONFIG = /(^|[\/])\.planning[\/]config\.json$/;
const SHIP_SKILL = /(^|[:/])gsd[-:]ship$/i;

// The implementation agent edits the whole worktree (the workspace guard keeps every write inside it), but not the run's
// .planning/config.json (its models and commands are set per run by PowerLoom), and it never runs GSD's ship step: the
// person pushes and opens the pull request (user decision 2026-10-29). The shell already refuses git push.
export const implementationPolicy: ToolPolicy = (call) => configRefusal(call) ?? shipRefusal(call) ?? { allow: true };

function configRefusal(call: ToolPolicyCall): ToolPolicyDecision | null {
  const target = writeTarget(call);

  if (target === null || !RUN_CONFIG.test(target)) {
    return null;
  }

  return { allow: false, reason: `${call.name} was blocked: .planning/config.json is set for this run by PowerLoom (models, build and test commands); don't change it.` };
}

function shipRefusal(call: ToolPolicyCall): ToolPolicyDecision | null {
  const skill = (call.input as { skill?: unknown } | null)?.skill;

  if (call.name !== "Skill" || typeof skill !== "string" || !SHIP_SKILL.test(skill.trim())) {
    return null;
  }

  return { allow: false, reason: "GSD's ship step was blocked: the implementation agent never pushes or opens a pull request; hand the branch over to a person instead." };
}
