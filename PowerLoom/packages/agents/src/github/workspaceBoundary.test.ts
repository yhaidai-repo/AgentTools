import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import type { RepoCache } from "@agenttools/runtime";
import { GitHubWorkspace } from "./GitHubWorkspace";
import type { WorkCopy } from "./models/WorkCopy";

it("rejects external writers/removers and metadata casing or canonical aliases", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "github-workspace-scope-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, "copy"), outside = join(folder, "outside");
  for (const path of [join(root, ".git"), join(root, "inside"), outside]) await mkdir(path, { recursive: true });
  await writeFile(join(outside, "keep.txt"), "original");
  await writeFile(join(root, ".git", "config"), "metadata");
  const link = (target: string, alias: string) => symlink(target, alias, process.platform === "win32" ? "junction" : "dir");
  await link(outside, join(root, "external"));
  await link(join(root, ".git"), join(root, "metadata-alias"));
  await link(join(root, "inside"), join(root, "internal"));
  const workspace = new GitHubWorkspace({} as RepoCache, 7, "AT-1", "synthetic");
  const copy = { path: root } as WorkCopy;
  for (const path of ["external/keep.txt", "external/new/deep.txt", ".git/config", ".GIT/config", "metadata-alias/config", ...(process.platform === "win32" ? [".git./config", ".git /config"] : [])]) {
    await assert.rejects(workspace.write(copy, path, "changed"));
    await assert.rejects(workspace.read(copy, path));
    await assert.rejects(workspace.remove(copy, path));
  }
  assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "original");
  assert.equal(await readFile(join(root, ".git", "config"), "utf8"), "metadata");
  await workspace.write(copy, ".github/workflows/test.yml", "normal");
  await workspace.write(copy, "internal/new.txt", "inside");
  assert.equal(await workspace.read(copy, "inside/new.txt"), "inside");
  await workspace.remove(copy, "internal/new.txt");
});
