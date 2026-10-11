import type { localItem } from "@powerloom/db";
import type { AgentRunResult } from "./AgentRunResult";
import type { TaskContext } from "./TaskContext";

// Runs one agent task (one agent run) and commits its outputs on success; ending the task is the caller's job.
export type TaskExecutor = (context: TaskContext, task: typeof localItem.$inferSelect) => Promise<AgentRunResult>;
