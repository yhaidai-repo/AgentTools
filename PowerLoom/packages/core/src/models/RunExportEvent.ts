/** One trace event of an exported run, uncut, with the name and one-line summary the run page shows. */
export interface RunExportEvent {
  seq: number;
  at: Date;
  type: string;
  name: string;
  summary: string;
  payload: Record<string, unknown>;
}
