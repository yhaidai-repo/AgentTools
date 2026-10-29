import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RelevantPage } from "../../models/RelevantPage";
import type { DesignOutput } from "./DesignOutput";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface DesignDraft {
  design: DesignOutput | null;
  captures: CaptureDraft[];
  pages: RelevantPage[];
}
