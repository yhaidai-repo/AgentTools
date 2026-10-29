import type { GuideTimelineStep } from "@powerloom/core";
import type { Raster } from "../media/models/Raster";

// One GIF frame: the masked page right before a recorded action (or the final state), and that action.
export interface CapturedFrame {
  raster: Raster;
  rawSha256: string;
  masks: number;
  step: Omit<GuideTimelineStep, "delayMs"> & { click: boolean };
}
