// A question or task the PBI already has (or the run already created), for the duplicate check.
export interface KnownItem {
  id: string;
  kind: string;
  status: string;
  text: string;
}
