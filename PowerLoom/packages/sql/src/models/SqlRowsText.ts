// Rows as a reader gets them (an agent's tool, a chat's CLI command): a count, the table and its notes, cut to fit.
export interface SqlRowsText {
  text: string;
  rows: number;
  truncated: boolean;
}
