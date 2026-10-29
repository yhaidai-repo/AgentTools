import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { AgentCapabilities } from "../../models/AgentCapabilities";
import type { ProjectSettingSource } from "../../models/ProjectSettingSource";

type Grant = keyof AgentCapabilities;

// Claude Code's built-in tools per grant, as SDK 0.3.310 names them (BUILTIN_TOOL_NAMES): LS and MultiEdit are gone,
// and Task is only a legacy alias of Agent.
const GRANTED_TOOLS: Record<Grant, string[]> = {
  webAccess: ["WebSearch", "WebFetch"],
  readCode: ["Read", "Grep", "Glob"],
  editCode: ["Edit", "Write", "NotebookEdit"],
  shell: ["Bash"],
  subAgents: ["Agent"],
};

// The edit tools are left out of allowedTools on purpose: an allow rule would let them write anywhere, while
// acceptEdits accepts them only inside the run's folder (and its additional directories); anything else would ask,
// and a run has nobody to ask, so it is denied.
const ACCEPTED_BY_MODE: Grant[] = ["editCode"];

// The grants whose tools change files without anyone approving each call.
const UNATTENDED_WRITE_GRANTS: Grant[] = ["editCode", "shell"];

export function builtInTools(capabilities: AgentCapabilities | undefined): string[] {
  return grantsOf(capabilities).flatMap((grant) => GRANTED_TOOLS[grant]);
}

export function autoAllowedBuiltInTools(capabilities: AgentCapabilities | undefined): string[] {
  return grantsOf(capabilities).filter((grant) => !ACCEPTED_BY_MODE.includes(grant)).flatMap((grant) => GRANTED_TOOLS[grant]);
}

// The folder's own commands (GSD's /gsd-* workflows) are skills the project settings load; without Skill the agent could
// see them listed but never run one.
export function projectSkillTools(settingSources: ProjectSettingSource[] | undefined): string[] {
  return settingSources?.includes("project") ? ["Skill"] : [];
}

export function writesUnattended(capabilities: AgentCapabilities | undefined): boolean {
  return grantsOf(capabilities).some((grant) => UNATTENDED_WRITE_GRANTS.includes(grant));
}

// dontAsk denies whatever allowedTools doesn't list. A run that edits needs acceptEdits instead, which accepts file
// edits inside its folder; bypassPermissions is never used, as it would also accept edits outside it.
export function permissionMode(capabilities: AgentCapabilities | undefined): PermissionMode {
  return writesUnattended(capabilities) ? "acceptEdits" : "dontAsk";
}

function grantsOf(capabilities: AgentCapabilities | undefined): Grant[] {
  return (Object.keys(GRANTED_TOOLS) as Grant[]).filter((grant) => capabilities?.[grant] === true);
}
