import type { AgentWorkspace } from "@agenttools/runtime";
import type { BuildCommands } from "@powerloom/db";
import type { ReviewOutcome } from "./ReviewOutcome";

// What an implementation run prepares once: what the review decided, and for an approved plan the worktree it builds in
// with the repo's build and test commands.
export interface PreparedImplementation {
  outcome: ReviewOutcome;
  workspace: AgentWorkspace | null;
  commands: BuildCommands;
}
