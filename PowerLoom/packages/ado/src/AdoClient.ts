import { linkedWorkItemId, toChange, toComment, toIteration, toPullRequest, toRepository, toThread, toWorkItemWithRelations } from "./dtoMapping";
import type { AdoComment } from "./models/AdoComment";
import type { AdoConnection } from "./models/AdoConnection";
import type { AdoIteration } from "./models/AdoIteration";
import type { AdoPrChange } from "./models/AdoPrChange";
import type { AdoPrThread } from "./models/AdoPrThread";
import type { AdoPullRequest } from "./models/AdoPullRequest";
import type { AdoPullRequestDetails } from "./models/AdoPullRequestDetails";
import type { AdoPullRequestSearch } from "./models/AdoPullRequestSearch";
import type { AdoRepository } from "./models/AdoRepository";
import type { AdoWorkItem } from "./models/AdoWorkItem";
import type { AdoWorkItemWithRelations } from "./models/AdoWorkItemWithRelations";
import type { DownloadedFile } from "./models/DownloadedFile";
import type { IterationDto } from "./models/IterationDto";
import type { PrChangeDto } from "./models/PrChangeDto";
import type { PrThreadDto } from "./models/PrThreadDto";
import type { PullRequestDto } from "./models/PullRequestDto";
import type { RepositoryDto } from "./models/RepositoryDto";
import type { WorkItemCommentDto } from "./models/WorkItemCommentDto";
import type { WorkItemRelationsDto } from "./models/WorkItemRelationsDto";
import { AdoRequestError } from "./models/AdoRequestError";
import { pullRequestCriteria } from "./pullRequestCriteria";

const API_VERSION = "api-version=7.1";
// Work item comments have no released 7.1 version yet.
const COMMENTS_API_VERSION = "api-version=7.1-preview.4";
const BATCH_LIMIT = 200;
const PULL_REQUEST_PAGE = 100;
// ADO's own cap for one iteration's changes call.
const CHANGES_LIMIT = 2000;

// Read-only Azure DevOps REST client. Never add write calls: PowerLoom is local-only.
export class AdoClient {
  private readonly orgUrl: string;

  constructor(private readonly connection: AdoConnection) {
    this.orgUrl = connection.orgUrl.replace(/\/+$/, "");
  }

  async queryIds(wiql: string, top?: number): Promise<number[]> {
    const limit = top === undefined ? "" : `$top=${top}&`;
    const url = `${this.projectUrl()}/_apis/wit/wiql?${limit}${API_VERSION}`;
    const body = await this.request<{ workItems: { id: number }[] }>(url, { query: wiql });

    return body.workItems.map((item) => item.id);
  }

  async getWorkItems(ids: number[], fields: string[]): Promise<AdoWorkItem[]> {
    const items: AdoWorkItem[] = [];

    for (let start = 0; start < ids.length; start += BATCH_LIMIT) {
      const batch = ids.slice(start, start + BATCH_LIMIT);

      items.push(...(await this.getWorkItemBatch(batch, fields)));
    }

    return items;
  }

  // One work item with all its fields and links; the batch call can't expand links.
  async getWorkItem(id: number): Promise<AdoWorkItemWithRelations> {
    const url = `${this.projectUrl()}/_apis/wit/workitems/${id}?$expand=relations&${API_VERSION}`;

    return toWorkItemWithRelations(await this.request<WorkItemRelationsDto>(url));
  }

  // The work items one item links with a relation type (e.g. Tested By).
  async getLinkedIds(id: number, relation: string): Promise<number[]> {
    const item = await this.getWorkItem(id);

    return item.relations.filter((link) => link.rel === relation).map(linkedWorkItemId).filter(Number.isInteger);
  }

  // The newest comments of a work item's discussion, oldest of them first.
  async getWorkItemComments(id: number, top: number): Promise<AdoComment[]> {
    const url = `${this.projectUrl()}/_apis/wit/workItems/${id}/comments?$top=${top}&${COMMENTS_API_VERSION}`;
    const body = await this.request<{ comments: WorkItemCommentDto[] }>(url);

    return body.comments.map(toComment).reverse();
  }

  // ADO only accepts `current` as a timeframe filter; without it, all team iterations are returned.
  async getIterations(onlyCurrent: boolean): Promise<AdoIteration[]> {
    const team = encodeURIComponent(this.connection.team);
    const filter = onlyCurrent ? "$timeframe=current&" : "";
    const url = `${this.projectUrl()}/${team}/_apis/work/teamsettings/iterations?${filter}${API_VERSION}`;
    const body = await this.request<{ value: IterationDto[] }>(url);

    return body.value.map(toIteration);
  }

  async listRepositories(): Promise<AdoRepository[]> {
    const body = await this.request<{ value: RepositoryDto[] }>(`${this.orgUrl}/_apis/git/repositories?${API_VERSION}`);

    return body.value.map(toRepository);
  }

  // Every active pull request of the project, page by page (ADO returns at most a page per call).
  async listActivePullRequests(): Promise<AdoPullRequest[]> {
    const pullRequests: AdoPullRequest[] = [];
    let page: AdoPullRequest[] = [];

    do {
      page = await this.searchPullRequests({ status: "active", top: PULL_REQUEST_PAGE }, pullRequests.length);
      pullRequests.push(...page);
    } while (page.length === PULL_REQUEST_PAGE);

    return pullRequests;
  }

  // The project's pull requests matching the search, newest first. A repository is narrowed by its path, not by
  // searchCriteria.repositoryId: the path takes a repository's name too, the criterion only its id.
  async searchPullRequests(search: AdoPullRequestSearch, skip = 0): Promise<AdoPullRequest[]> {
    const scope = search.repoId ? `/_apis/git/repositories/${encodeURIComponent(search.repoId)}` : "/_apis/git";
    const url = `${this.projectUrl()}${scope}/pullrequests?${pullRequestCriteria(search)}&$top=${search.top}&$skip=${skip}&${API_VERSION}`;
    const body = await this.request<{ value: PullRequestDto[] }>(url);

    return body.value.map((dto) => toPullRequest(dto, this.projectUrl()));
  }

  // A pull request of any repository of the project, by its id alone.
  async getPullRequest(pullRequestId: number): Promise<AdoPullRequest> {
    const url = `${this.projectUrl()}/_apis/git/pullrequests/${pullRequestId}?${API_VERSION}`;

    return toPullRequest(await this.request<PullRequestDto>(url), this.projectUrl());
  }

  async getPullRequestDetails(repoId: string, pullRequestId: number): Promise<AdoPullRequestDetails> {
    const base = this.pullRequestUrl(repoId, pullRequestId);
    const iterations = await this.request<{ value: { id: number }[] }>(`${base}/iterations?${API_VERSION}`);
    const workItems = await this.request<{ value: { id: string }[] }>(`${base}/workitems?${API_VERSION}`);

    return {
      iteration: Math.max(1, ...iterations.value.map((iteration) => iteration.id)),
      workItemIds: workItems.value.map((item) => Number(item.id)).filter(Number.isInteger),
    };
  }

  // Every comment thread of a pull request that wasn't deleted, system threads (votes, pushes) included.
  async getPullRequestThreads(repoId: string, pullRequestId: number): Promise<AdoPrThread[]> {
    const url = `${this.pullRequestUrl(repoId, pullRequestId)}/threads?${API_VERSION}`;
    const body = await this.request<{ value: PrThreadDto[] }>(url);

    return body.value.filter((thread) => !thread.isDeleted).map(toThread);
  }

  // The files the pull request changes as of an iteration, against its target branch.
  async getPullRequestChanges(repoId: string, pullRequestId: number, iteration: number, signal?: AbortSignal): Promise<AdoPrChange[]> {
    const changes: AdoPrChange[] = [];
    let skip = 0;
    let top = CHANGES_LIMIT;
    while (true) {
      signal?.throwIfAborted();
      const url = `${this.pullRequestUrl(repoId, pullRequestId)}/iterations/${iteration}/changes?$compareTo=0&$top=${top}&$skip=${skip}&${API_VERSION}`;
      const body = await this.request<{ changeEntries: PrChangeDto[]; nextSkip?: number; nextTop?: number }>(url, undefined, signal);
      changes.push(...body.changeEntries.filter((entry) => !entry.item?.isFolder).map(toChange));
      if (!body.nextSkip && !body.nextTop) return changes;
      if (!Number.isSafeInteger(body.nextSkip) || body.nextSkip! <= skip || !Number.isSafeInteger(body.nextTop) || body.nextTop! <= 0 || body.nextTop! > CHANGES_LIMIT) {
        throw new AdoRequestError(502, "Azure DevOps returned invalid changes pagination; the file list is incomplete");
      }
      skip = body.nextSkip!;
      top = body.nextTop!;
    }
  }

  // A work item attachment linked from a description. The token is only ever sent to this organization.
  async downloadAttachment(url: string): Promise<DownloadedFile> {
    if (!url.toLowerCase().startsWith(`${this.orgUrl.toLowerCase()}/`)) {
      throw new AdoRequestError(400, `not an attachment of ${this.orgUrl}: ${url}`);
    }

    const response = await fetch(url, { headers: { Authorization: this.headers().Authorization, Accept: "*/*" } });
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";

    // An expired token answers with the HTML sign-in page instead of the file.
    if (!response.ok || contentType.includes("text/html")) {
      throw new AdoRequestError(response.status, `download failed (${response.status} ${contentType}): ${url}`);
    }

    return { fileName: new URL(url).searchParams.get("fileName") ?? "attachment", contentType, bytes: Buffer.from(await response.arrayBuffer()) };
  }

  private async getWorkItemBatch(ids: number[], fields: string[]): Promise<AdoWorkItem[]> {
    const url = `${this.projectUrl()}/_apis/wit/workitemsbatch?${API_VERSION}`;
    // Omit: items deleted in ADO come back as null instead of failing the whole batch.
    const body = await this.request<{ value: (AdoWorkItem | null)[] }>(url, { ids, fields, errorPolicy: "Omit" });

    return body.value.filter((item): item is AdoWorkItem => item !== null);
  }

  // The repository may be named by its id or its name.
  private pullRequestUrl(repoId: string, pullRequestId: number): string {
    return `${this.projectUrl()}/_apis/git/repositories/${encodeURIComponent(repoId)}/pullRequests/${pullRequestId}`;
  }

  private projectUrl(): string {
    return `${this.orgUrl}/${encodeURIComponent(this.connection.project)}`;
  }

  private async request<T>(url: string, body?: object, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    await ensureJsonSuccess(response);

    return (await response.json()) as T;
  }

  private headers(): Record<string, string> {
    const token = Buffer.from(`:${this.connection.pat}`).toString("base64");

    return { Authorization: `Basic ${token}`, "Content-Type": "application/json", Accept: "application/json" };
  }
}

// A bad or expired PAT often returns an HTML sign-in page with 200/203 instead of 401.
async function ensureJsonSuccess(response: Response): Promise<void> {
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;

  if (response.ok && isJson) {
    return;
  }

  if (!isJson) {
    throw new AdoRequestError(response.status, "Azure DevOps did not return JSON: check the token and the organization URL");
  }

  const detail = (await response.json().catch(() => null)) as { message?: string } | null;

  throw new AdoRequestError(response.status, detail?.message ?? `Azure DevOps request failed (${response.status})`);
}
