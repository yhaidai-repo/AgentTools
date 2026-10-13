// A branch or commit the repo tools read: what the agent asked for and the commit it is now.
export interface ResolvedRef {
  ref: string;
  commit: string;
}
