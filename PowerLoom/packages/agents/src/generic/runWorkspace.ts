import type { AgentDefinition } from "@agenttools/config";
import type { AgentCapabilities } from "@agenttools/runtime";
import type { localItem } from "@powerloom/db";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterWorkspace } from "../toolset/models/WriterWorkspace";

type ItemRow = typeof localItem.$inferSelect;

// The worktree of the first granted writer that wants one; a run has one working folder.
export async function writerWorkspace(writers: RunWriter[], task: ItemRow): Promise<WriterWorkspace | null> {
  const workspaces = await Promise.all(writers.map((writer) => writer.workspace?.(task) ?? null));

  return workspaces.find((workspace) => workspace !== null) ?? null;
}

// The runtime's built-in tools read, edit and run commands in the run's folder, so they are given only to a run in a
// worktree of its own, never in the host's folder; web access needs no folder.
export function runCapabilities(capabilities: AgentDefinition["capabilities"], workspace: WriterWorkspace | null): AgentCapabilities {
  if (!workspace) {
    return { webAccess: capabilities.webAccess };
  }

  return { webAccess: capabilities.webAccess, readCode: capabilities.readCode, editCode: capabilities.editCode, shell: capabilities.shell, subAgents: capabilities.subAgents };
}

export function workspaceInput(workspace: WriterWorkspace | null): Pick<AgentRunInput, "workspace" | "toolPolicy"> {
  return workspace ? { workspace: workspace.workspace, toolPolicy: workspace.toolPolicy } : {};
}
