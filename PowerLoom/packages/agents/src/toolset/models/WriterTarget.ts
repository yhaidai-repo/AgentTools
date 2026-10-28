import type { RunHandoff } from "@powerloom/core";
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
  /** The tasks create_task and hand_off made in this run, already written, and their ids in the same order. */
  tasks: CreatedTask[];
  taskIds: string[];
  /** The run's hand_off calls among them: what each asked of which item. Only the tool's hand-offs: one a writer makes
   *  while committing (refinement's follow-up) isn't here, while settleTask reads every hand-off of the run (handoffsOfRun). */
  handoffs: RunHandoff[];
  repos: RepoAccess;
  /** What write_result recorded, when it was called before the commit. */
  result: ResultDraft | null;
  /** The budget stopped the run: its work is kept, but nothing may queue more runs. */
  stoppedEarly: boolean;
}
