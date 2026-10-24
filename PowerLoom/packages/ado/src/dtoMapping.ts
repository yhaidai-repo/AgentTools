import type { AdoComment } from "./models/AdoComment";
import type { AdoIteration } from "./models/AdoIteration";
import type { AdoPrChange } from "./models/AdoPrChange";
import type { AdoPrThread } from "./models/AdoPrThread";
import type { AdoPullRequest } from "./models/AdoPullRequest";
import type { AdoRelation } from "./models/AdoRelation";
import type { AdoRepository } from "./models/AdoRepository";
import type { AdoWorkItemWithRelations } from "./models/AdoWorkItemWithRelations";
import type { IterationDto } from "./models/IterationDto";
import type { PrChangeDto } from "./models/PrChangeDto";
import type { PrThreadDto } from "./models/PrThreadDto";
import type { PullRequestDto } from "./models/PullRequestDto";
import type { RepositoryDto } from "./models/RepositoryDto";
import type { WorkItemCommentDto } from "./models/WorkItemCommentDto";
import type { WorkItemRelationsDto } from "./models/WorkItemRelationsDto";

type Identity = { uniqueName?: string; displayName?: string } | undefined;

// The id a work item link points to (its url ends in the id); NaN for links to anything else.
export function linkedWorkItemId(relation: AdoRelation): number {
  return Number(relation.url.split("/").pop());
}

export function toWorkItemWithRelations(dto: WorkItemRelationsDto): AdoWorkItemWithRelations {
  const relations = (dto.relations ?? []).map((link) => ({ rel: link.rel, url: link.url, name: link.attributes?.name ?? null, comment: link.attributes?.comment || null }));

  return { id: dto.id, rev: dto.rev, fields: dto.fields, relations };
}

export function toComment(dto: WorkItemCommentDto): AdoComment {
  return { author: nameOf(dto.createdBy), createdAt: dto.createdDate ?? null, text: dto.text ?? "" };
}

export function toPullRequest(dto: PullRequestDto, projectUrl: string): AdoPullRequest {
  const repoName = dto.repository.name;
  const reviewers = dto.reviewers ?? [];

  return {
    id: dto.pullRequestId,
    repoId: dto.repository.id,
    repoName,
    title: dto.title,
    description: dto.description ?? null,
    status: dto.status ?? "unknown",
    isDraft: dto.isDraft ?? false,
    author: nameOf(dto.createdBy),
    sourceRef: dto.sourceRefName,
    targetRef: dto.targetRefName,
    sourceCommit: dto.lastMergeSourceCommit?.commitId ?? null,
    targetCommit: dto.lastMergeTargetCommit?.commitId ?? null,
    mergeCommit: dto.status === "completed" ? (dto.lastMergeCommit?.commitId ?? null) : null,
    reviewers: reviewers.filter((reviewer) => !reviewer.isContainer && reviewer.uniqueName).map((reviewer) => reviewer.uniqueName!),
    votes: reviewers.map((reviewer) => ({ name: reviewer.displayName ?? reviewer.uniqueName ?? "unknown", vote: reviewer.vote ?? 0, isRequired: reviewer.isRequired ?? false })),
    createdAt: dto.creationDate ?? null,
    closedAt: dto.closedDate ?? null,
    url: `${projectUrl}/_git/${encodeURIComponent(repoName)}/pullrequest/${dto.pullRequestId}`,
  };
}

// A thread on a deleted file line keeps its left-side (old) lines only.
export function toThread(dto: PrThreadDto): AdoPrThread {
  const context = dto.threadContext ?? null;
  const start = context?.rightFileStart ?? context?.leftFileStart;
  const end = context?.rightFileEnd ?? context?.leftFileEnd;
  const comments = (dto.comments ?? []).map((comment) => ({
    id: comment.id,
    parentId: comment.parentCommentId ?? 0,
    author: nameOf(comment.author),
    createdAt: comment.publishedDate ?? null,
    type: comment.commentType ?? "text",
    content: comment.content ?? "",
    isDeleted: comment.isDeleted ?? false,
  }));

  return { id: dto.id, status: dto.status ?? "unknown", filePath: context?.filePath ?? null, startLine: start?.line ?? null, endLine: end?.line ?? null, comments };
}

export function toChange(dto: PrChangeDto): AdoPrChange {
  return { path: dto.item?.path ?? "", changeType: dto.changeType ?? "edit", originalPath: dto.originalPath ?? null };
}

export function toIteration(dto: IterationDto): AdoIteration {
  return {
    id: dto.id,
    name: dto.name,
    path: dto.path,
    startDate: dto.attributes?.startDate ?? null,
    finishDate: dto.attributes?.finishDate ?? null,
    timeFrame: (dto.attributes?.timeFrame as AdoIteration["timeFrame"]) ?? null,
  };
}

export function toRepository(dto: RepositoryDto): AdoRepository {
  return {
    id: dto.id,
    name: dto.name,
    project: dto.project.name,
    remoteUrl: dto.remoteUrl,
    defaultBranch: dto.defaultBranch ?? null,
    isDisabled: dto.isDisabled ?? false,
  };
}

function nameOf(identity: Identity): string | null {
  return identity?.uniqueName ?? identity?.displayName ?? null;
}
