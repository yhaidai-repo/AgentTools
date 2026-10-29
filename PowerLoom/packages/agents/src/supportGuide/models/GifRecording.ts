import type { CapturedFrame } from "./CapturedFrame";

// A GIF segment of the open browser case: recording until stop_guide_gif, then waiting for add_guide_gif.
export interface GifRecording {
  name: string;
  caseName: string;
  frames: CapturedFrame[];
  stopped: boolean;
}
