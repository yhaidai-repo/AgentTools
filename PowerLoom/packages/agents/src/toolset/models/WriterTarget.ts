import type { localItem } from "@powerloom/db";
import type { AgentDeps } from "../../models/AgentDeps";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResultDraft } from "../../result/models/ResultDraft";

// What a shared writer gets when the run commits: the task and run, what the toolset already wrote, the repos read.
export interface WriterTarget {
  deps: AgentDeps;
  task: typeof localItem.$inferSelect;
  runId: number;
  agentId: string;
  /** The tasks create_task made in this run, already written. */
  taskIds: string[];
  repos: RepoAccess;
  /** What write_result recorded, when it was called before the commit. */
  result: ResultDraft | null;
}
