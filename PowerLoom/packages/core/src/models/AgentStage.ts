import type { ItemPrefix } from "../localItemIds";
import type { PipelineStatus } from "./PipelineStatus";

// How one agent's tasks look and what they mean for the PBI's pipeline status.
export interface AgentStage {
  kind: "refinement" | "research" | "design";
  prefix: ItemPrefix;
  /** PBI status while one of its tasks runs. */
  running: PipelineStatus;
  /** PBI status while one of its tasks waits to be dispatched. */
  waiting: PipelineStatus;
  /** Title of a task the app creates (research tasks get theirs from the agent). */
  title: string;
}
