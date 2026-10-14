import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { AgentRunSession } from "../AgentRunSession";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { noRepos, openRepos, READ_REPOS_INTEGRATION } from "./openRepos";
import { reposBlock } from "./reposBlock";

const PVS = { name: "PVS", remoteUrl: "https://x/_git/PVS", defaultBranch: "main" };

function contextWith(readRepos: boolean): TaskContext {
  const agent = { options: {}, capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: readRepos } } } as unknown as AgentDefinition;
  const repoCache = { acquire: async () => assert.fail("the cache must not be touched"), release: () => {}, root: "/repo-cache/v" };

  return { deps: { repoCache }, agent } as unknown as TaskContext;
}

// Read repositories on, nothing attached: the catalog is still there for open_repo (select().from().where().orderBy()).
function contextWithCatalog(): TaskContext {
  const agent = { options: {}, capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true } } } as unknown as AgentDefinition;
  const db = { select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [PVS] }) }) }) };
  const repoCache = { acquire: async () => ({}), release: () => {}, root: "/repo-cache/v", refs: {} };

  return { deps: { db, repoCache }, agent } as unknown as TaskContext;
}

function sessionLog(): { session: AgentRunSession; phases: Record<string, unknown>[] } {
  const phases: Record<string, unknown>[] = [];

  return { session: { phase: async (name: string, detail: Record<string, unknown>) => { phases.push({ name, ...detail }); } } as unknown as AgentRunSession, phases };
}

describe("openRepos", () => {
  it("opens nothing and leaves the cache alone while Read repositories is off", async () => {
    const { session, phases } = sessionLog();

    const access = await openRepos(contextWith(false), session, [{ vault: "v", names: ["PVS"] }]);

    assert.deepEqual(access, noRepos());
    assert.deepEqual(phases, [{ name: "repos", readRepos: false }]);
  });

  it("offers open_repo for the task's vault when nothing is attached to the task", async () => {
    const { session } = sessionLog();

    const access = await openRepos(contextWithCatalog(), session, [], { vault: "v" });

    assert.equal(access.isOn, true);
    assert.deepEqual(access.repos, []);
    assert.ok(access.tools.some((tool) => tool.name === "open_repo"));
  });
});

describe("reposBlock", () => {
  it("says the switch is off", () => {
    assert.match(reposBlock(noRepos()), /Read repositories is off/);
  });

  it("says no enabled repo is attached when the switch is on but none is", () => {
    assert.match(reposBlock({ ...noRepos(), isOn: true }), /no enabled repository is attached/);
  });

  it("lists each repo with its commit and branch", () => {
    const access: RepoAccess = { isOn: true, repos: [PVS], commits: { PVS: "756b975531234" }, tools: [] };

    assert.equal(reposBlock(access), "<repos>\n- PVS @ 756b975531 (branch main)\n</repos>");
  });
});
