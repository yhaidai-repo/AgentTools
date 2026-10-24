import type { ToolDefinition } from "@agenttools/runtime";
import type { AdoClient, AdoPullRequestSearch } from "@powerloom/ado";
import { z } from "zod";
import type { AdoAccess } from "../models/AdoAccess";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { PULL_REQUESTS, adoFailure, adoResource, limitedResult } from "./adoToolResults";
import { pullRequestListText, pullRequestMarkdown, threadsMarkdown, withoutSystemComments } from "./pullRequestMarkdown";

const DEFAULT_PULL_REQUESTS = 25;
const MAX_PULL_REQUESTS = 100;

const listInput = {
  repo: z.string().optional().describe("Only this repository, by name, e.g. PVS"),
  status: z.enum(["active", "completed", "abandoned", "all"]).optional().describe("Default active"),
  sourceBranch: z.string().optional().describe("Only PRs from this branch, e.g. feature/32071-medicare-hcpcs-codes"),
  targetBranch: z.string().optional().describe("Only PRs into this branch, e.g. development"),
  top: z.number().int().min(1).max(MAX_PULL_REQUESTS).optional().describe(`At most this many, newest first (default ${DEFAULT_PULL_REQUESTS})`),
};

type ListInput = z.infer<z.ZodObject<typeof listInput>>;

const idInput = z.number().int().positive().describe("The pull request id, e.g. 6400");

export function pullRequestTools(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess): ToolDefinition<any>[] {
  return [listPullRequestsTool(deps, context, access), readPullRequestTool(deps, context, access), readThreadsTool(deps, context, access)];
}

function listPullRequestsTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "list_pull_requests",
    description: "List Azure DevOps pull requests of the project, newest first: id, status, repository, title, branches, author and dates. Filter by repository, status and branches, e.g. to find the PR of a branch.",
    input: listInput,
    resource: () => adoResource(access, PULL_REQUESTS),
    request: (input) => JSON.stringify(input),
    handler: async (input) => listPullRequests(access.client, searchOf(input)),
  });
}

function readPullRequestTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_pull_request",
    description: "Read an Azure DevOps pull request by id: repository, status, source and target branch, author, reviewers and their votes, merge commit, linked work items, description and changed files. Its comments: read_pr_threads.",
    input: {
      id: idInput,
      files: z.boolean().optional().describe("List the changed files (default true)"),
    },
    resource: () => adoResource(access, PULL_REQUESTS),
    request: (input) => `PR ${input.id}`,
    handler: async (input) => readPullRequest(access.client, input.id, input.files ?? true),
  });
}

function readThreadsTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_pr_threads",
    description: "Read the review comment threads of an Azure DevOps pull request by id: each thread's status (active, fixed, wontFix, closed, ...), its file and lines, and its comments with replies. ADO's own comments (votes, pushes) are left out unless asked for.",
    input: {
      id: idInput,
      system: z.boolean().optional().describe("Include ADO's own comments (votes, pushes, status changes); default false"),
    },
    resource: () => adoResource(access, PULL_REQUESTS),
    request: (input) => `threads of PR ${input.id}`,
    handler: async (input) => readThreads(access.client, input.id, input.system ?? false),
  });
}

async function listPullRequests(client: AdoClient, search: AdoPullRequestSearch): Promise<OutsideToolResult> {
  try {
    const found = await client.searchPullRequests(search);

    return limitedResult(pullRequestListText(found), found.length);
  } catch (error) {
    return adoFailure(error);
  }
}

async function readPullRequest(client: AdoClient, id: number, withFiles: boolean): Promise<OutsideToolResult> {
  try {
    const pullRequest = await client.getPullRequest(id);
    const details = await client.getPullRequestDetails(pullRequest.repoId, id);
    const changes = withFiles ? await client.getPullRequestChanges(pullRequest.repoId, id, details.iteration) : null;

    return limitedResult(pullRequestMarkdown(pullRequest, details, changes), 1);
  } catch (error) {
    return adoFailure(error);
  }
}

async function readThreads(client: AdoClient, id: number, withSystem: boolean): Promise<OutsideToolResult> {
  try {
    const pullRequest = await client.getPullRequest(id);
    const threads = await client.getPullRequestThreads(pullRequest.repoId, id);
    const shown = withSystem ? threads : withoutSystemComments(threads);

    return limitedResult(threadsMarkdown(pullRequest, shown), shown.length);
  } catch (error) {
    return adoFailure(error);
  }
}

function searchOf(input: ListInput): AdoPullRequestSearch {
  return {
    status: input.status ?? "active",
    repoId: input.repo,
    sourceRef: refOf(input.sourceBranch),
    targetRef: refOf(input.targetBranch),
    top: input.top ?? DEFAULT_PULL_REQUESTS,
  };
}

// ADO filters by the full ref name; agents name branches as git shows them.
function refOf(branch: string | undefined): string | undefined {
  if (!branch) {
    return undefined;
  }

  return branch.startsWith("refs/") ? branch : `refs/heads/${branch}`;
}
