import type { ToolDefinition } from "@agenttools/runtime";
import type { localItem } from "@powerloom/db";
import type { ReadLog } from "../../evidence/ReadLog";
import type { RepoSource } from "../../models/RepoSource";
import type { OpenReposOptions } from "../../models/OpenReposOptions";
import type { SharedRunState } from "./SharedRunState";
import type { WriterRunContext } from "./WriterRunContext";
import type { WriterSettlement } from "./WriterSettlement";
import type { WriterTarget } from "./WriterTarget";

// An output tool any agent can be granted (user decision 2026-10-22: writers are shared and granted like readers), with
// the commit that stores what it recorded once the run succeeds. Returns the ids it wrote, for the run's outputs.
export interface RunWriter {
  /** The Config grant (integration key) that gives this writer. */
  readonly integration: string;
  tools(log: ReadLog, shared: SharedRunState): ToolDefinition<any>[];
  commit(target: WriterTarget): Promise<string[]>;
  /** Only the draft to persist; stable across replay, without mutable read context or timestamps. */
  commitDraft?(): unknown;
  /** After the commit (or without one): what the writer's own output says about the task's end; the generic executor
   *  settles the task, a writer never sets its status. Null when write_result's status alone decides. */
  settlement?(): WriterSettlement | null;
  /** Blocks the writer adds to the first message: what its tools work on (a draft, a note, a PR checked out here). */
  contextBlocks?(task: typeof localItem.$inferSelect, run: WriterRunContext): Promise<string[]>;
  /** Sections the writer adds to the instructions (a vault's rules). */
  promptSections?(task: typeof localItem.$inferSelect): Promise<string[]>;
  /** Repos the writer's work needs open besides the task's own (a vault's projects, a PR's repo). */
  repoSources?(task: typeof localItem.$inferSelect): Promise<RepoSource[]>;
  /** How the repos open for the writer's work (a PR checkout as the tools' root). */
  repoOptions?(task: typeof localItem.$inferSelect, runId: number): OpenReposOptions;
  /** What the writer leaves behind (a checkout), removed when the run ends, whatever happened. */
  cleanUp?(): Promise<void>;
}
