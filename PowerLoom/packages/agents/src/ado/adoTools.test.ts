import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import { AdoRequestError, type AdoClient, type AdoPrThread, type AdoPullRequest } from "@powerloom/ado";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { ADO_INTEGRATION, createAdoTools } from "./adoTools";

const context = { vault: "work-projects", agentId: "better-research", runId: 1275, taskId: "GT-002", pbiId: 36973 };

const PULL_REQUEST: AdoPullRequest = {
  id: 6400,
  repoId: "repo-1",
  repoName: "PVS",
  title: "Medicare HCPCS codes",
  description: "Adds the codes.",
  status: "active",
  isDraft: false,
  author: "dev@example.com",
  sourceRef: "refs/heads/feature/32071-medicare-hcpcs-codes",
  targetRef: "refs/heads/development",
  sourceCommit: "def456",
  targetCommit: "000111",
  mergeCommit: null,
  reviewers: ["lead@example.com"],
  votes: [{ name: "Lead", vote: -5, isRequired: true }],
  createdAt: "2026-10-12T09:00:00Z",
  closedAt: null,
  url: "https://dev.azure.com/org/AA/_git/PVS/pullrequest/6400",
};

const THREADS: AdoPrThread[] = [
  {
    id: 11,
    status: "active",
    filePath: "/src/Codes.cs",
    startLine: 12,
    endLine: 14,
    comments: [
      { id: 1, parentId: 0, author: "lead@example.com", createdAt: "2026-10-12T10:00:00Z", type: "text", content: "Use the shared lookup", isDeleted: false },
      { id: 2, parentId: 1, author: "dev@example.com", createdAt: "2026-10-12T11:00:00Z", type: "text", content: "Done", isDeleted: false },
    ],
  },
  { id: 12, status: "unknown", filePath: null, startLine: null, endLine: null, comments: [{ id: 1, parentId: 0, author: null, createdAt: null, type: "system", content: "Lead voted -5", isDeleted: false }] },
];

const client: Partial<AdoClient> = {
  getWorkItem: async (id) => ({
    id,
    rev: 7,
    fields: {
      "System.WorkItemType": "Bug",
      "System.Title": "HCPCS codes missing",
      "System.State": "Active",
      "System.AssignedTo": { displayName: "Dev One", uniqueName: "dev@example.com" },
      "System.Watermark": 99,
      "System.Description": "<p>Codes are <b>missing</b></p>",
    },
    relations: [
      { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/org/_apis/wit/workItems/32071", name: "Parent", comment: null },
      { rel: "ArtifactLink", url: "vstfs:///Git/PullRequestId/proj%2Frepo-1%2F6400", name: "Pull Request", comment: null },
    ],
  }),
  getWorkItemComments: async () => [{ author: "lead@example.com", createdAt: "2026-10-12T08:00:00Z", text: "<p>See PR 6400</p>" }],
  searchPullRequests: async () => [PULL_REQUEST],
  getPullRequest: async () => PULL_REQUEST,
  getPullRequestDetails: async () => ({ iteration: 3, workItemIds: [36973] }),
  getPullRequestChanges: async () => [{ path: "/src/Codes.cs", changeType: "edit", originalPath: null }],
  getPullRequestThreads: async () => THREADS,
};

function agentWith(isOn: boolean): AgentDefinition {
  return { capabilities: { webAccess: false, integrations: { [ADO_INTEGRATION]: isOn } } } as unknown as AgentDefinition;
}

function depsWith(adoClient: Partial<AdoClient> | null): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-36973-002", created: true }) } };
  const ado = adoClient ? { client: adoClient as AdoClient, orgUrl: "https://dev.azure.com/org" } : null;

  return { deps: { outside, ado } as unknown as AgentDeps, entries };
}

function toolNamed(name: string, deps: AgentDeps) {
  const tool = createAdoTools(deps, agentWith(true), context).find((candidate) => candidate.name === name);

  assert.ok(tool, `${name} is missing`);

  return tool;
}

describe("createAdoTools", () => {
  it("gives the tools only with the agent's switch on and the vault's Azure DevOps on", () => {
    assert.equal(createAdoTools(depsWith(client).deps, agentWith(false), context).length, 0);
    assert.equal(createAdoTools(depsWith(null).deps, agentWith(true), context).length, 0);
    assert.deepEqual(createAdoTools(depsWith(client).deps, agentWith(true), context).map((tool) => tool.name), [
      "read_work_item",
      "query_work_items",
      "list_pull_requests",
      "read_pull_request",
      "read_pr_threads",
      "read_test_cases",
    ]);
  });

  it("leaves read_test_cases out on a run without a PBI", () => {
    const names = createAdoTools(depsWith(client).deps, agentWith(true), { ...context, pbiId: null }).map((tool) => tool.name);

    assert.equal(names.includes("read_test_cases"), false);
    assert.equal(names.length, 5);
  });
});

describe("read_work_item", () => {
  it("shows fields, the description as Markdown, links and comments, without bookkeeping fields", async () => {
    const { deps, entries } = depsWith(client);

    const result = await toolNamed("read_work_item", deps).handler({ id: 36973 });

    assert.match(result.text, /^# Bug 36973: HCPCS codes missing \(rev 7\)/);
    assert.match(result.text, /- System.AssignedTo: Dev One/);
    assert.doesNotMatch(result.text, /Watermark/);
    assert.match(result.text, /## Description\n\nCodes are \*\*missing\*\*/);
    assert.match(result.text, /- Parent: work item 32071/);
    assert.match(result.text, /- Pull Request: PR 6400/);
    assert.match(result.text, /### lead@example.com · 2026-10-12\n\nSee PR 6400/);
    assert.deepEqual([entries[0].kind, entries[0].resource, entries[0].outcome], ["ado", "Azure DevOps work items", "ok"]);
  });
});

describe("pull request tools", () => {
  it("lists pull requests with branch names as git shows them", async () => {
    const result = await toolNamed("list_pull_requests", depsWith(client).deps).handler({ status: "all", sourceBranch: "feature/32071-medicare-hcpcs-codes" });

    assert.equal(result.text, "- PR 6400 [active] PVS: Medicare HCPCS codes – feature/32071-medicare-hcpcs-codes → development, by dev@example.com, created 2026-10-12");
  });

  it("asks ADO for the full ref of a branch", async () => {
    const searches: unknown[] = [];
    const recording: Partial<AdoClient> = { searchPullRequests: async (search) => { searches.push(search); return []; } };

    const result = await toolNamed("list_pull_requests", depsWith(recording).deps).handler({ repo: "PVS", targetBranch: "development" });

    assert.equal(result.text, "No pull requests match.");
    assert.deepEqual(searches, [{ status: "active", repoId: "PVS", sourceRef: undefined, targetRef: "refs/heads/development", top: 25 }]);
  });

  it("reads a pull request with votes, linked work items and changed files", async () => {
    const result = await toolNamed("read_pull_request", depsWith(client).deps).handler({ id: 6400 });

    assert.match(result.text, /- Branches: feature\/32071-medicare-hcpcs-codes → development/);
    assert.match(result.text, /- Lead \(required\): waiting for the author/);
    assert.match(result.text, /- Linked work items: 36973 \(read_work_item\)/);
    assert.match(result.text, /## Changed files \(1\)\n- edit \/src\/Codes.cs/);
  });

  it("reads threads with replies under their comment and leaves ADO's own comments out", async () => {
    const result = await toolNamed("read_pr_threads", depsWith(client).deps).handler({ id: 6400 });

    assert.match(result.text, /\(1\)\n\n## Thread 11 \[active\] on \/src\/Codes.cs:12-14\n- lead@example.com \(2026-10-12\): Use the shared lookup\n  - dev@example.com \(2026-10-12\): Done$/);
    assert.doesNotMatch(result.text, /voted/);
  });

  it("logs a PAT without Code (Read) as denied and asks the user for access", async () => {
    const refusing: Partial<AdoClient> = { getPullRequest: async () => { throw new AdoRequestError(401, "TF400813: not authorized"); } };
    const { deps, entries } = depsWith(refusing);

    const result = await toolNamed("read_pr_threads", deps).handler({ id: 6400 });

    assert.equal(result.isError, true);
    assert.match(result.text, /HT-36973-002/);
    assert.deepEqual([entries[0].resource, entries[0].outcome], ["Azure DevOps pull requests", "denied"]);
  });
});
