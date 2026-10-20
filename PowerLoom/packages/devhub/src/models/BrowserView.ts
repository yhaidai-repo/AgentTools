// The page after a call: address, title and the accessibility snapshot the next action targets.
export interface BrowserView {
  url: string;
  title: string;
  snapshot: string;
  snapshotCut: boolean;
}
