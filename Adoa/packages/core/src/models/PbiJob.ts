// A one-off refresh of one PBI (documents, hand-ons, status, notes) after an item changed.
export interface PbiJob {
  action: "refresh";
  adoId: number;
}
