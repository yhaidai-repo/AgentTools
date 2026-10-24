// DELETE /browser: the closed case and the files it left on the host (video, trace).
export interface BrowserClosed {
  case: string;
  artifacts: string[];
}
