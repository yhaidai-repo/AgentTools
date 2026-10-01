// The Runs page filters, read from the URL. agent: "" = every agent; outcome: "" = every outcome.
export interface RunListFilter {
  agent: string;
  range: string;
  outcome: string;
}
