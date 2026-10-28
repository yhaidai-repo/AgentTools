import type { BuildContent } from "@powerloom/db";

// One stored version of a PBI's implementation, without the inspect snapshot it was read from.
export interface BuildVersion {
  id: number;
  pbiId: number;
  version: number;
  planVersion: number | null;
  runId: number | null;
  createdAt: Date;
  build: BuildContent;
}
