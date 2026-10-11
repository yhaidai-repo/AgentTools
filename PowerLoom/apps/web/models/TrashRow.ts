// A trashed file as the Maintenance tab lists it (dates as ISO strings cross to the client component).
export interface TrashRow {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}
