import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { it } from "node:test";
import type { ToolDefinition } from "../models/ToolDefinition";
import { createRepoTools } from "../repos/repoTools";
import { createDocTools } from "./docTools";

const run = promisify(execFile);
const link = (target: string, alias: string) => symlink(target, alias, process.platform === "win32" ? "junction" : "dir");
const tool = (tools: ToolDefinition<any>[], name: string) => tools.find((item) => item.name === name)!;

it("enforces canonical docs containment and hidden/excluded rules in list, read and search", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "doc-scope-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, "docs");
  for (const name of ["docs", "outside", "docs/allowed", "docs/excluded", "docs/.hidden"]) await mkdir(join(folder, name), { recursive: true });
  for (const name of ["allowed", "excluded", ".hidden"]) await writeFile(join(root, name, "example.md"), `synthetic ${name}`);
  await writeFile(join(folder, "outside", "example.md"), "synthetic outside");
  for (const [name, target] of [["external-alias", join(folder, "outside")], ["hidden-alias", join(root, ".hidden")], ["excluded-alias", join(root, "excluded")], ["allowed-alias", join(root, "allowed")]]) {
    await link(target, join(root, name));
  }
  const tools = createDocTools({ root, exclude: ["excluded"] });
  const listing = await tool(tools, "list_docs").handler({ dir: "" });
  assert.doesNotMatch(listing.text, /external|hidden|excluded/);
  assert.match(listing.text, /allowed/);
  for (const name of ["external-alias", "hidden-alias", "excluded-alias"]) {
    await assert.rejects(tool(tools, "read_doc").handler({ path: `${name}/example.md`, offset: 0 }));
    await assert.rejects(tool(tools, "list_docs").handler({ dir: name }));
    await assert.rejects(tool(tools, "search_docs").handler({ dir: name, query: "synthetic" }));
  }
  assert.equal((await tool(tools, "read_doc").handler({ path: "allowed-alias/example.md", offset: 0 })).text, "synthetic allowed");
  const found = await tool(tools, "search_docs").handler({ dir: "", query: "synthetic" });
  assert.match(found.text, /synthetic allowed/);
  assert.doesNotMatch(found.text, /synthetic outside|synthetic excluded|synthetic \.hidden/);
});

it("keeps checkout aliases within the selected allowed repo", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "repo-scope-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const name of ["repo-a", "repo-b", "repo-a/inside"]) await mkdir(join(folder, name), { recursive: true });
  await writeFile(join(folder, "repo-a", "normal.txt"), "synthetic allowed");
  await writeFile(join(folder, "repo-a", "inside", "example.txt"), "synthetic internal");
  await writeFile(join(folder, "repo-b", "example.txt"), "synthetic ungranted");
  await run("git", ["init", "-q"], { cwd: join(folder, "repo-a") });
  await run("git", ["add", "normal.txt"], { cwd: join(folder, "repo-a") });
  await link(join(folder, "repo-b"), join(folder, "repo-a", "external-alias"));
  await link(join(folder, "repo-a", "inside"), join(folder, "repo-a", "internal-alias"));
  const tools = createRepoTools({ root: folder, repos: ["repo-a"] });
  const listing = await tool(tools, "list_files").handler({ path: "repo-a" });
  assert.doesNotMatch(listing.text, /external-alias/);
  assert.match(listing.text, /normal.txt/);
  await assert.rejects(tool(tools, "read_file").handler({ path: "repo-a/external-alias/example.txt", offset: 0 }));
  await assert.rejects(tool(tools, "list_files").handler({ path: "repo-a/external-alias" }));
  await assert.rejects(tool(tools, "read_file").handler({ path: "repo-b/example.txt", offset: 0 }));
  assert.match((await tool(tools, "read_file").handler({ path: "repo-a/internal-alias/example.txt", offset: 0 })).text, /synthetic internal/);
  assert.match((await tool(tools, "search_code").handler({ query: "synthetic" })).text, /synthetic allowed/);
  await assert.rejects(tool(tools, "search_code").handler({ query: "synthetic", repo: "repo-b" }));
});
