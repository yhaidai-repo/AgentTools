import type { PipelineStatus } from "./models/PipelineStatus";

// Not prepared yet, already finished, or closed in ADO (user decision 2026-10-05: any prepared PBI can be finished).
// The finish itself is PowerLoom's; the pages show the button for these.
const UNFINISHABLE: PipelineStatus[] = ["new", "done", "closed"];

export function isFinishable(status: PipelineStatus): boolean {
  return !UNFINISHABLE.includes(status);
}
