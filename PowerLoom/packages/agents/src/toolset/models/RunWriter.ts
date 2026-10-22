import type { ToolDefinition } from "@agenttools/runtime";
import type { localItem } from "@powerloom/db";
import type { ReadLog } from "../../evidence/ReadLog";
import type { RepoSource } from "../../models/RepoSource";
import type { SharedRunState } from "./SharedRunState";
import type { WriterTarget } from "./WriterTarget";

// An output tool any agent can be granted (user decision 2026-10-22: writers are shared and granted like readers), with
// the commit that stores what it recorded once the run succeeds. Returns the ids it wrote, for the run's outputs.
export interface RunWriter {
  tools(log: ReadLog, shared: SharedRunState): ToolDefinition<any>[];
  commit(target: WriterTarget): Promise<string[]>;
  /** Blocks the writer adds to the first message: what its tools work on (a draft, a note). */
  contextBlocks?(task: typeof localItem.$inferSelect): Promise<string[]>;
  /** Sections the writer adds to the instructions (a vault's rules). */
  promptSections?(task: typeof localItem.$inferSelect): Promise<string[]>;
  /** Repos the writer's work needs open besides the task's own (a vault's projects). */
  repoSources?(task: typeof localItem.$inferSelect): Promise<RepoSource[]>;
}
