import type { ToolPolicy, ToolPolicyCall } from "@agenttools/runtime";

// Claude Code's tools that write, with the input field naming the file.
const WRITE_FIELDS: Record<string, string> = {
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
};

const PLANNING_SEGMENT = ".planning";

// The planning agent is read-only on code (user decision 2026-10-28), but GSD's planner and its sub-agents write their
// documents with the edit tools: those may write under .planning/ only. The runtime's workspace guard already keeps every
// write inside the worktree, so a `.planning` segment there is the worktree's own folder.
export const planningDocsOnly: ToolPolicy = (call) => {
  const target = writeTarget(call);

  if (target === null || isPlanningPath(target)) {
    return { allow: true };
  }

  return { allow: false, reason: `${call.name} was blocked: planning is read-only on code; only files under .planning/ may be written.` };
};

function writeTarget(call: ToolPolicyCall): string | null {
  const field = WRITE_FIELDS[call.name];
  const value = field ? (call.input as Record<string, unknown> | null)?.[field] : null;

  return typeof value === "string" ? value : null;
}

function isPlanningPath(path: string): boolean {
  return path.split(/[\\/]+/).includes(PLANNING_SEGMENT);
}
