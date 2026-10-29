import type { GuideImage } from "@powerloom/core";
import type { GuideCapture } from "../capture/GuideCapture";
import type { NewGuideMedia } from "./NewGuideMedia";

// What the image and GIF tools need from the Demonstration writer: the run's capture boundary and the checkpoint.
export interface GuideMediaHost {
  readonly capture: GuideCapture;
  /** Why media cannot be saved yet (no resolved guide input), or null. */
  mediaProblem(): string | null;
  saveMedia(media: NewGuideMedia, content: Buffer): Promise<GuideImage | { problem: string }>;
  approveMedia(name: string, sha256: string): Promise<GuideImage | { problem: string }>;
}
