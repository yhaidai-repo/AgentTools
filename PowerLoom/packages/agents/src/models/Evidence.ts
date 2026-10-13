// One source behind a claim: the id the read log gave what the agent read, where that is for a reader, and what it shows.
export interface Evidence {
  source: string;
  ref: string;
  note: string;
  quote?: string;
}
