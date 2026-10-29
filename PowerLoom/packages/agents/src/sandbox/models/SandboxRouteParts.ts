import type { ToolDefinition } from "@agenttools/runtime";
import type { OutsideAccessContext } from "../../models/OutsideAccessContext";
import type { OutsideAccessServices } from "../../models/OutsideAccessServices";
import type { RunBuildLog } from "./RunBuildLog";
import type { RunSandbox } from "./RunSandbox";
import type { RunWorktreeSlot } from "./RunWorktreeSlot";
import type { SandboxAccess } from "./SandboxAccess";

// What the worktree shell's route shares with the run's sandbox tools: the same sandbox, and the tools that open it,
// sync the worktree into it and restore its packages, each logging its own call, and the run's build log.
export interface SandboxRouteParts {
  tools: { open: ToolDefinition<any>; sync: ToolDefinition<any>; restore: ToolDefinition<any> };
  access: SandboxAccess;
  sandbox: RunSandbox;
  worktree: RunWorktreeSlot;
  outside: OutsideAccessServices;
  context: OutsideAccessContext;
  log: RunBuildLog | null;
}
