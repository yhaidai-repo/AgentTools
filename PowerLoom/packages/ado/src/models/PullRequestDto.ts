export interface PullRequestDto {
  pullRequestId: number;
  title: string;
  description?: string;
  status?: string;
  isDraft?: boolean;
  creationDate?: string;
  closedDate?: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy?: { uniqueName?: string; displayName?: string };
  repository: { id: string; name: string };
  lastMergeSourceCommit?: { commitId: string };
  lastMergeTargetCommit?: { commitId: string };
  lastMergeCommit?: { commitId: string };
  reviewers?: { uniqueName?: string; displayName?: string; isContainer?: boolean; vote?: number; isRequired?: boolean }[];
}
