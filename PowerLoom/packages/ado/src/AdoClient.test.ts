import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { AdoClient } from "./AdoClient";
import { AdoRequestError } from "./models/AdoRequestError";

const PROJECT = "https://dev.azure.com/org/Proj%20X";
const client = new AdoClient({ orgUrl: "https://dev.azure.com/org/", project: "Proj X", team: "Team", pat: "secret" });

const PR_DTO = {
  pullRequestId: 6400,
  title: "Medicare HCPCS codes",
  status: "completed",
  closedDate: "2026-10-13T10:00:00Z",
  sourceRefName: "refs/heads/feature/32071-medicare-hcpcs-codes",
  targetRefName: "refs/heads/development",
  createdBy: { uniqueName: "dev@example.com" },
  repository: { id: "repo-1", name: "POS" },
  lastMergeCommit: { commitId: "abc123" },
  reviewers: [
    { uniqueName: "lead@example.com", displayName: "Lead", vote: 10, isRequired: true },
    { displayName: "POS Team", isContainer: true, vote: 0 },
  ],
};

// Answers every call with the body the first matching url part names, and records the urls.
function answer(bodies: Record<string, unknown>): string[] {
  const urls: string[] = [];

  mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);

    const key = Object.keys(bodies).find((part) => url.includes(part));

    return new Response(JSON.stringify(key ? bodies[key] : {}), { status: 200, headers: { "content-type": "application/json" } });
  });

  return urls;
}

afterEach(() => mock.restoreAll());

describe("AdoClient work items", () => {
  it("reads one work item with its links and their names", async () => {
    const urls = answer({
      "/workitems/36973": {
        id: 36973,
        rev: 4,
        fields: { "System.Title": "Codes" },
        relations: [
          { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/org/_apis/wit/workItems/36000", attributes: { name: "Parent" } },
          { rel: "ArtifactLink", url: "vstfs:///Git/PullRequestId/p%2Frepo-1%2F6400", attributes: { name: "Pull Request", comment: "" } },
        ],
      },
    });

    const item = await client.getWorkItem(36973);

    assert.equal(urls[0], `${PROJECT}/_apis/wit/workitems/36973?$expand=relations&api-version=7.1`);
    assert.deepEqual(item.relations.map((link) => [link.name, link.comment]), [["Parent", null], ["Pull Request", null]]);
    assert.deepEqual(await client.getLinkedIds(36973, "System.LinkTypes.Hierarchy-Reverse"), [36000]);
  });

  it("lists the newest comments oldest first", async () => {
    const urls = answer({ "/comments": { comments: [{ text: "second", createdBy: { displayName: "B" } }, { text: "first", createdBy: { uniqueName: "a@example.com" } }] } });

    const comments = await client.getWorkItemComments(36973, 50);

    assert.equal(urls[0], `${PROJECT}/_apis/wit/workItems/36973/comments?$top=50&api-version=7.1-preview.4`);
    assert.deepEqual(comments.map((comment) => [comment.author, comment.text]), [["a@example.com", "first"], ["B", "second"]]);
  });

  it("caps a query when asked", async () => {
    const urls = answer({ "/wiql": { workItems: [{ id: 1 }, { id: 2 }] } });

    assert.deepEqual(await client.queryIds("SELECT [System.Id] FROM WorkItems", 2), [1, 2]);
    assert.equal(urls[0], `${PROJECT}/_apis/wit/wiql?$top=2&api-version=7.1`);
  });
});

describe("AdoClient pull requests", () => {
  it("searches with only the filters given", async () => {
    const urls = answer({ "pullrequests?": { value: [PR_DTO] } });

    const found = await client.searchPullRequests({ status: "all", repoId: "POS", sourceRef: "refs/heads/feature/x", top: 20 });

    assert.equal(urls[0], `${PROJECT}/_apis/git/repositories/POS/pullrequests?searchCriteria.status=all&searchCriteria.sourceRefName=refs%2Fheads%2Ffeature%2Fx&$top=20&$skip=0&api-version=7.1`);
    assert.equal(found[0].sourceRef, "refs/heads/feature/32071-medicare-hcpcs-codes");
  });

  it("reads a pull request by id with votes and its merge commit", async () => {
    answer({ "/pullrequests/6400": PR_DTO });

    const pullRequest = await client.getPullRequest(6400);

    assert.equal(pullRequest.mergeCommit, "abc123");
    assert.deepEqual(pullRequest.reviewers, ["lead@example.com"]);
    assert.deepEqual(pullRequest.votes, [{ name: "Lead", vote: 10, isRequired: true }, { name: "POS Team", vote: 0, isRequired: false }]);
    assert.equal(pullRequest.url, `${PROJECT}/_git/POS/pullrequest/6400`);
  });

  it("reads threads without deleted ones, with file and lines", async () => {
    const urls = answer({
      "/threads": {
        value: [
          { id: 1, status: "active", threadContext: { filePath: "/src/A.cs", rightFileStart: { line: 12 }, rightFileEnd: { line: 14 } }, comments: [{ id: 1, content: "Use the helper", commentType: "text", author: { uniqueName: "lead@example.com" } }] },
          { id: 2, isDeleted: true, comments: [] },
          { id: 3, threadContext: null, comments: [{ id: 1, content: "Lead voted 10", commentType: "system" }] },
        ],
      },
    });

    const threads = await client.getPullRequestThreads("POS", 6400);

    assert.equal(urls[0], `${PROJECT}/_apis/git/repositories/POS/pullRequests/6400/threads?api-version=7.1`);
    assert.deepEqual(threads.map((thread) => [thread.id, thread.status, thread.filePath, thread.startLine, thread.endLine]), [[1, "active", "/src/A.cs", 12, 14], [3, "unknown", null, null, null]]);
    assert.equal(threads[1].comments[0].type, "system");
  });

  it("lists changed files without folders", async () => {
    const urls = answer({ "/changes": { changeEntries: [{ changeType: "edit", item: { path: "/src/A.cs" } }, { changeType: "add", item: { path: "/src", isFolder: true } }, { changeType: "rename", originalPath: "/old.cs", item: { path: "/new.cs" } }] } });

    const changes = await client.getPullRequestChanges("repo-1", 6400, 3);

    assert.equal(urls[0], `${PROJECT}/_apis/git/repositories/repo-1/pullRequests/6400/iterations/3/changes?$compareTo=0&$top=2000&api-version=7.1`);
    assert.deepEqual(changes, [{ path: "/src/A.cs", changeType: "edit", originalPath: null }, { path: "/new.cs", changeType: "rename", originalPath: "/old.cs" }]);
  });

  it("fails with the status when ADO answers with the sign-in page", async () => {
    mock.method(globalThis, "fetch", async () => new Response("<html>sign in</html>", { status: 203, headers: { "content-type": "text/html" } }));

    await assert.rejects(client.getPullRequest(6400), (error: unknown) => error instanceof AdoRequestError && error.status === 203);
  });
});
