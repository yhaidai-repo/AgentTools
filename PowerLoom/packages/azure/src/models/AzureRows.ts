export interface AzureRows {
  columns: string[];
  rows: unknown[][];
  /** The read had more rows than the reader returns. */
  truncated: boolean;
}
