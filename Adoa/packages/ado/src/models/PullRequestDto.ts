export interface PullRequestDto {
  pullRequestId: number;
  title: string;
  description?: string;
  isDraft?: boolean;
  creationDate?: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy?: { uniqueName?: string; displayName?: string };
  repository: { id: string; name: string };
  lastMergeSourceCommit?: { commitId: string };
  lastMergeTargetCommit?: { commitId: string };
  reviewers?: { uniqueName?: string; isContainer?: boolean }[];
}
