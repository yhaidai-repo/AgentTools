// What Prepare did per PBI: notes written and a refinement task queued, unknown to PowerLoom, or closed (reopen first).
export interface PreparedPbis {
  queued: number[];
  unknown: number[];
  closed: number[];
}
