import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RelevantPage } from "../../models/RelevantPage";
import type { DesignOutput } from "./DesignOutput";
import type { GapItem } from "./GapItem";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface DesignDraft {
  design: DesignOutput | null;
  gaps: GapItem[];
  captures: CaptureDraft[];
  pages: RelevantPage[];
}
