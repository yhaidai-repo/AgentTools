import type { PipelineStatus } from "./models/PipelineStatus";

// Already finished, or closed in ADO. A PBI that was never prepared can be finished too (user decision 2026-10-13: e.g. a
// parent whose bug children were the work). The finish itself is PowerLoom's; the pages show the button for these.
const UNFINISHABLE: PipelineStatus[] = ["done", "closed"];

export function isFinishable(status: PipelineStatus): boolean {
  return !UNFINISHABLE.includes(status);
}
