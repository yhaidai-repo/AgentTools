import type { ResultStatus } from "../../models/ResultStatus";
import type { AffectedArea } from "./AffectedArea";
import type { Blocker } from "./Blocker";
import type { EvidencedItem } from "./EvidencedItem";
import type { RepoPick } from "./RepoPick";
import type { TestData } from "./TestData";

// Better Refinement's full result, stored in refinement.details next to the columns every reader already shows.
export interface RefinementDetails {
  version: 2;
  status: Exclude<ResultStatus, "not_found">;
  sources: EvidencedItem[];
  repos: RepoPick[];
  affectedAreas: AffectedArea[];
  testData: TestData;
  dependencies: EvidencedItem[];
  blockers: Blocker[];
  nextReason: string;
}
