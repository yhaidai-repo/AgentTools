export interface SqlRows {
  columns: string[];
  rows: unknown[][];
  /** The query had more rows than the reader returns. */
  truncated: boolean;
  /** Result sets after the first, which aren't returned. */
  moreResultSets: number;
}
