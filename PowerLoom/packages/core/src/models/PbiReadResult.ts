// What pbi.read returns: the reference and its full text (a PBI's context, or JSON for a refinement, design, item, draft).
export interface PbiReadResult {
  ref: string;
  text: string;
}
