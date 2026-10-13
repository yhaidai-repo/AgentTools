import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { GitRefReader } from "./GitRefReader";
import { git } from "./git";
import { createRepoTools } from "./repoTools";

let workspace: string;
let tools: Map<string, (input: Record<string, unknown>) => Promise<{ text: string }>>;

// An origin with main and a feature branch, cloned single-branch into a cache root like RepoCache's.
async function setUpRepos(): Promise<void> {
  workspace = await mkdtemp(join(tmpdir(), "repo-refs-"));

  const origin = join(workspace, "origin");
  const cacheRoot = join(workspace, "cache");
  const author = ["-c", "user.name=Test", "-c", "user.email=test@example.com"];

  await git(["init", "-q", "-b", "main", origin]);
  await writeFile(join(origin, "Report.sql"), "SELECT ISNULL(vp.Title, tr.ProviderKey) AS Provider\n");
  await git([...author, "-C", origin, "add", "."]);
  await git([...author, "-C", origin, "commit", "-q", "-m", "report"]);
  await git(["-C", origin, "switch", "-q", "-c", "improvement/33649-Rename-report"]);
  await writeFile(join(origin, "Report.sql"), "SELECT COALESCE(vp.Title, vpk.Title, tr.ProviderKey) AS Provider\n");
  await git([...author, "-C", origin, "commit", "-q", "-am", "rename"]);
  await git(["-C", origin, "switch", "-q", "main"]);
  await git(["clone", "-q", "--single-branch", "--branch", "main", origin, join(cacheRoot, "PVS")]);

  const reader = new GitRefReader(cacheRoot, (args, cwd) => git(args, cwd));

  tools = new Map(createRepoTools({ root: cacheRoot, repos: ["PVS"], refs: reader }).map((tool) => [tool.name, tool.handler as never]));
}

function call(name: string, input: Record<string, unknown>) {
  return tools.get(name)!(input);
}

describe("repo tools with refs", () => {
  before(setUpRepos);
  after(() => rm(workspace, { recursive: true, force: true }));

  it("finds a branch by part of its name", async () => {
    const result = await call("list_branches", { repo: "PVS", filter: "33649" });

    assert.equal(result.text, "improvement/33649-Rename-report");
  });

  it("reads and searches a branch the checkout doesn't have, naming the commit it read", async () => {
    const onMain = await call("read_file", { path: "PVS/Report.sql", offset: 0 });
    const onBranch = await call("read_file", { path: "PVS/Report.sql", offset: 0, ref: "improvement/33649-Rename-report" });
    const found = await call("search_code", { query: "COALESCE", repo: "PVS", ref: "improvement/33649-Rename-report" });

    assert.match(onMain.text, /ISNULL/);
    assert.match(onBranch.text, /^\[PVS@improvement\/33649-Rename-report [0-9a-f]{10}\]\n1: SELECT COALESCE/);
    assert.match(found.text, /PVS\/Report\.sql:1:SELECT COALESCE/);
  });

  it("diffs the branch against main", async () => {
    const result = await call("git_diff", { repo: "PVS", base: "main", head: "improvement/33649-Rename-report" });

    assert.match(result.text, /-SELECT ISNULL\(vp\.Title, tr\.ProviderKey\)/);
    assert.match(result.text, /\+SELECT COALESCE\(vp\.Title, vpk\.Title, tr\.ProviderKey\)/);
  });

  it("refuses a ref that git would read as an option", async () => {
    await assert.rejects(call("read_file", { path: "PVS/Report.sql", offset: 0, ref: "--output=x" }), /Not a branch name or commit id/);
  });
});
