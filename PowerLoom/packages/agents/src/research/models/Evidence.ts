export interface Evidence {
  /** "<repo>/<path>:<line>" or a doc path, plus a symbol when there is one. */
  location: string;
  note: string;
}
