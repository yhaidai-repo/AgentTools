// What a PBI import did with one PBI: synced and prepared, only synced, left alone (already in the pipeline, deleted in
// adoa, or refused because it's already started in ADO), or failed with the reason.
export interface PbiImportResult {
  adoId: number;
  outcome: "prepared" | "synced" | "in-pipeline" | "deleted" | "refused" | "failed";
  detail?: string;
}
