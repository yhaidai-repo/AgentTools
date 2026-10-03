// A pull request's branches as the git server names them (e.g. "refs/heads/feature/x"); the id keeps its refs apart.
export interface PullRequestRef {
  id: number;
  sourceRef: string;
  targetRef: string;
}
