import type { AdoConnection } from "./models/AdoConnection";
import type { AdoIteration } from "./models/AdoIteration";
import type { AdoPullRequest } from "./models/AdoPullRequest";
import type { AdoPullRequestDetails } from "./models/AdoPullRequestDetails";
import type { AdoRepository } from "./models/AdoRepository";
import type { AdoWorkItem } from "./models/AdoWorkItem";
import type { DownloadedFile } from "./models/DownloadedFile";
import type { IterationDto } from "./models/IterationDto";
import type { PullRequestDto } from "./models/PullRequestDto";
import type { RepositoryDto } from "./models/RepositoryDto";
import { AdoRequestError } from "./models/AdoRequestError";

const API_VERSION = "api-version=7.1";
const BATCH_LIMIT = 200;
const PULL_REQUEST_PAGE = 100;

// Read-only Azure DevOps REST client. Never add write calls: PowerLoom is local-only.
export class AdoClient {
  private readonly orgUrl: string;

  constructor(private readonly connection: AdoConnection) {
    this.orgUrl = connection.orgUrl.replace(/\/+$/, "");
  }

  async queryIds(wiql: string): Promise<number[]> {
    const url = `${this.projectUrl()}/_apis/wit/wiql?${API_VERSION}`;
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
    let page: PullRequestDto[] = [];

    do {
      const url = `${this.projectUrl()}/_apis/git/pullrequests?searchCriteria.status=active&$top=${PULL_REQUEST_PAGE}&$skip=${pullRequests.length}&${API_VERSION}`;

      page = (await this.request<{ value: PullRequestDto[] }>(url)).value;
      pullRequests.push(...page.map((dto) => this.toPullRequest(dto)));
    } while (page.length === PULL_REQUEST_PAGE);

    return pullRequests;
  }

  async getPullRequestDetails(repoId: string, pullRequestId: number): Promise<AdoPullRequestDetails> {
    const base = `${this.projectUrl()}/_apis/git/repositories/${repoId}/pullRequests/${pullRequestId}`;
    const iterations = await this.request<{ value: { id: number }[] }>(`${base}/iterations?${API_VERSION}`);
    const workItems = await this.request<{ value: { id: string }[] }>(`${base}/workitems?${API_VERSION}`);

    return {
      iteration: Math.max(1, ...iterations.value.map((iteration) => iteration.id)),
      workItemIds: workItems.value.map((item) => Number(item.id)).filter(Number.isInteger),
    };
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

  private toPullRequest(dto: PullRequestDto): AdoPullRequest {
    const repoName = dto.repository.name;

    return {
      id: dto.pullRequestId,
      repoId: dto.repository.id,
      repoName,
      title: dto.title,
      description: dto.description ?? null,
      isDraft: dto.isDraft ?? false,
      author: dto.createdBy?.uniqueName ?? dto.createdBy?.displayName ?? null,
      sourceRef: dto.sourceRefName,
      targetRef: dto.targetRefName,
      sourceCommit: dto.lastMergeSourceCommit?.commitId ?? null,
      targetCommit: dto.lastMergeTargetCommit?.commitId ?? null,
      reviewers: (dto.reviewers ?? []).filter((reviewer) => !reviewer.isContainer && reviewer.uniqueName).map((reviewer) => reviewer.uniqueName!),
      createdAt: dto.creationDate ?? null,
      url: `${this.projectUrl()}/_git/${encodeURIComponent(repoName)}/pullrequest/${dto.pullRequestId}`,
    };
  }

  private projectUrl(): string {
    return `${this.orgUrl}/${encodeURIComponent(this.connection.project)}`;
  }

  private async request<T>(url: string, body?: object): Promise<T> {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
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

function toIteration(dto: IterationDto): AdoIteration {
  return {
    id: dto.id,
    name: dto.name,
    path: dto.path,
    startDate: dto.attributes?.startDate ?? null,
    finishDate: dto.attributes?.finishDate ?? null,
    timeFrame: (dto.attributes?.timeFrame as AdoIteration["timeFrame"]) ?? null,
  };
}

function toRepository(dto: RepositoryDto): AdoRepository {
  return {
    id: dto.id,
    name: dto.name,
    project: dto.project.name,
    remoteUrl: dto.remoteUrl,
    defaultBranch: dto.defaultBranch ?? null,
    isDisabled: dto.isDisabled ?? false,
  };
}
