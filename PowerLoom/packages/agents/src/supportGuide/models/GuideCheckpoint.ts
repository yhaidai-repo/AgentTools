import type { GuideImage, GuideReport } from "@powerloom/core";

// What survives a timeout on the task: the approved media and the latest report, for this exact guide input.
export interface GuideCheckpoint {
  requestHash: string;
  images: GuideImage[];
  report: GuideReport | null;
}
