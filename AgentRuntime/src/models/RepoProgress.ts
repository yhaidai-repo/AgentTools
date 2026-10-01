export interface RepoProgress {
  repo: string;
  action: "clone" | "refresh" | "reuse";
  durationMs: number;
  commit: string;
}
