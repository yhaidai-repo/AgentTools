import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentRunSession } from "../AgentRunSession";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { createOpenRepoTool } from "./openRepoTool";
import { reposBlock } from "./reposBlock";

const CATALOG = [
  { name: "POS", remoteUrl: "https://x/_git/POS", defaultBranch: "refs/heads/development" },
  { name: "VAPI v2", remoteUrl: "https://x/_git/VAPI%20v2", defaultBranch: "main" },
];

// enabledRepos: select().from().where().orderBy()
const db = { select: () => ({ from: () => ({ where: () => ({ orderBy: async () => CATALOG }) }) }) };
const session = { phase: async () => {} } as unknown as AgentRunSession;

function setup() {
  const acquired: string[] = [];
  const repoCache = { acquire: async (repos: { name: string }[]) => { acquired.push(...repos.map((repo) => repo.name)); return { [repos[0].name]: "abcdef1234567890" }; } };
  const context = { deps: { db, repoCache }, agent: { options: {} } } as unknown as TaskContext;
  const access: RepoAccess = { isOn: true, repos: [], commits: {}, tools: [] };
  const names: string[] = [];

  return { context, access, names, acquired };
}

describe("open_repo", () => {
  it("adds a catalog repo to the run's code tools and to what closeRepos releases", async () => {
    const { context, access, names, acquired } = setup();
    const tool = await createOpenRepoTool(context, session, access, names, "work-projects");

    const result = await tool.handler({ name: "vapi v2" });

    assert.equal(result.text, "Opened VAPI-v2 @ abcdef1234 (branch main); its paths start with 'VAPI-v2/'.");
    assert.deepEqual(names, ["VAPI-v2"]);
    assert.deepEqual(acquired, ["VAPI-v2"]);
    assert.deepEqual(access.repos.map((repo) => repo.name), ["VAPI-v2"]);
    assert.match(tool.description, /Catalog: POS, VAPI v2/);
  });

  it("refuses a repo the catalog doesn't have and opens nothing", async () => {
    const { context, access, names, acquired } = setup();
    const tool = await createOpenRepoTool(context, session, access, names, "work-projects");

    const result = await tool.handler({ name: "X12 Transformation" });

    assert.equal(result.isError, true);
    assert.match(result.text, /not an enabled repo in the catalog/);
    assert.deepEqual(acquired, []);
  });

  it("is named in the first message's repos block", async () => {
    const { context, access, names } = setup();

    access.tools = [await createOpenRepoTool(context, session, access, names, "work-projects")];

    assert.match(reposBlock(access), /add one with open_repo/);
  });
});
