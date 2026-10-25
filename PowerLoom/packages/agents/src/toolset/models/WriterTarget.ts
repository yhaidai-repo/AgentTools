import type { localItem } from "@powerloom/db";
import type { AgentDeps } from "../../models/AgentDeps";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResultDraft } from "../../result/models/ResultDraft";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";

// What a shared writer gets when the run commits: the task and run, what the toolset already wrote, the repos read.
export interface WriterTarget {
  deps: AgentDeps;
  task: typeof localItem.$inferSelect;
  runId: number;
  agentId: string;
  /** The tasks create_task made in this run, already written, and their ids in the same order. */
  tasks: CreatedTask[];
  taskIds: string[];
  repos: RepoAccess;
  /** What write_result recorded, when it was called before the commit. */
  result: ResultDraft | null;
  /** The run stopped on its budget: its work is kept, but nothing may queue more runs (the user Re-runs it). */
  budgetStopped: boolean;
}
