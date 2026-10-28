import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { snapshotOf } from "./repoSnapshot";

const TAR_BLOCK = 512;
const NAME_CHARS = 100;
const SIZE_OFFSET = 124;
const SIZE_CHARS = 12;

// A worktree with every folder the snapshot leaves out, at the root and nested.
const root = mkdtempSync(join(tmpdir(), "repo-snapshot-"));
const worktree = folderWith(join(root, "worktree"), [".git", ".planning/PLAN.md", ".claude/settings.json", "node_modules/x/index.js", "src/App.cs", "src/node_modules/kept.js", "docs/.planning/kept.md"]);
const cacheRoot = join(root, "cache");

folderWith(join(cacheRoot, "orders-api"), [".git/HEAD", ".planning/kept.md", "src/Cached.cs"]);

function folderWith(folder: string, files: string[]): string {
  for (const file of files) {
    mkdirSync(join(folder, file, ".."), { recursive: true });
    writeFileSync(join(folder, file), file);
  }

  return folder;
}

async function filesOf(tar: ReadableStream<Uint8Array>): Promise<string[]> {
  const bytes = Buffer.from(await new Response(tar).arrayBuffer());
  const names: string[] = [];

  for (let offset = 0; offset + TAR_BLOCK <= bytes.length && bytes[offset] !== 0; offset += TAR_BLOCK * (1 + Math.ceil(sizeAt(bytes, offset) / TAR_BLOCK))) {
    names.push(bytes.subarray(offset, offset + NAME_CHARS).toString("utf8").replace(/\0.*$/s, ""));
  }

  return names.filter((name) => !name.endsWith("/") && !name.includes("PaxHeader")).map((name) => name.replace(/^\.\//, "")).sort();
}

function sizeAt(bytes: Buffer, offset: number): number {
  return Number.parseInt(bytes.subarray(offset + SIZE_OFFSET, offset + SIZE_OFFSET + SIZE_CHARS).toString("utf8").trim() || "0", 8);
}

describe("snapshotOf", () => {
  it("copies the run's worktree for its repo, without .git, .planning, .claude and node_modules at the root", async () => {
    const files = await filesOf(snapshotOf(cacheRoot, { repo: "orders-api", path: worktree }, "orders-api"));

    assert.deepEqual(files, ["docs/.planning/kept.md", "src/App.cs", "src/node_modules/kept.js"]);
  });

  it("copies the cached checkout without .git when the run has no worktree", async () => {
    const files = await filesOf(snapshotOf(cacheRoot, null, "orders-api"));

    assert.deepEqual(files, [".planning/kept.md", "src/Cached.cs"]);
  });

  it("copies the cached checkout for a repo that isn't the worktree's", async () => {
    const files = await filesOf(snapshotOf(cacheRoot, { repo: "billing", path: worktree }, "orders-api"));

    assert.deepEqual(files, [".planning/kept.md", "src/Cached.cs"]);
  });

  it("sends an empty archive for a worktree with nothing but excluded folders", async () => {
    const files = await filesOf(snapshotOf(cacheRoot, { repo: "orders-api", path: folderWith(join(root, "bare"), [".git"]) }, "orders-api"));

    assert.deepEqual(files, []);
  });
});
