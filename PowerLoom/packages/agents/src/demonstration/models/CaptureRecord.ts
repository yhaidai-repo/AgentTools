import type { PixelBox } from "../media/models/PixelBox";

// A screenshot this run took through the capture wrapper: the raw file stays on the DevHub host; the masks were
// applied before the agent saw it and are applied again to every derivative.
export interface CaptureRecord {
  caseName: string;
  file: string;
  rawSha256: string;
  width: number;
  height: number;
  masks: PixelBox[];
}
