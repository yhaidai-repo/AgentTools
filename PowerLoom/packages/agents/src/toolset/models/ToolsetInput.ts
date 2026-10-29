import type { DuplicateGuard } from "../../DuplicateGuard";
import type { LiveTestRun } from "../../liveTest/LiveTestRun";
import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RepoAccess } from "../../models/RepoAccess";
import type { RunWriter } from "./RunWriter";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";

// What a runner hands the shared toolset: the repos it opened and, when its own draft keeps them, the arrays the
// create_task, hand_off and vault_capture tools fill (then the runner commits them with its draft).
export interface ToolsetInput {
  repos: RepoAccess;
  /** The vault root the docs tools read; the docs vault unless the task works on another vault (actualize). */
  docsRoot?: string;
  /** The creating task's depth when the task row doesn't carry it (refinement starts a PBI's chain at 0). */
  depth?: number;
  /** The run's duplicate guard, shared with the runner's own create tools; loaded from the PBI otherwise. */
  guard?: DuplicateGuard;
  tasks?: CreatedTask[];
  captures?: CaptureDraft[];
  /** The granted writers, when the runner built them first (to open their repos); by default the Config's. */
  writers?: RunWriter[];
  /** The run's live test (PowerLoom's commands, guarded); by default the Config's powerloomLiveTest grant decides. */
  liveTest?: LiveTestRun | null;
}
