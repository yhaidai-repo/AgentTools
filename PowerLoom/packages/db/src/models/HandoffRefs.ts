// What a hand-off's package points the target at, beside its markdown body: run results (RUN-<id>), items and notes.
export interface HandoffRefs {
  results: string[];
  items: string[];
  notes: string[];
}
