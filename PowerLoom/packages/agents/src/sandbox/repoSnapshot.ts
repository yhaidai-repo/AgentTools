import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { RunWorktree } from "./models/RunWorktree";

// A worktree holds the agent's own working folders next to the code: its GSD plan, its Claude settings and installed
// packages are no part of what the sandbox builds.
const WORKTREE_EXCLUDED = [".git", ".planning", ".claude", "node_modules"];
// An archive with no members: its two zero end blocks (tar refuses to write one).
const EMPTY_TAR_BYTES = 1024;

// The files of the repo a sandbox copy comes from: the run's worktree for its repo, else the cached checkout.
export function snapshotOf(cacheRoot: string, worktree: RunWorktree | null, name: string): ReadableStream<Uint8Array> {
  if (isWorktreeRepo(worktree, name)) {
    return repoSnapshot(worktree!.path, WORKTREE_EXCLUDED);
  }

  return repoSnapshot(join(cacheRoot, name));
}

export function isWorktreeRepo(worktree: RunWorktree | null, name: string): boolean {
  return worktree?.repo === name;
}

// A folder's files as a tar stream, without .git: the copy in the sandbox carries no remote, no history and no
// sign-in. The cache never refreshes a repo while a run holds it, so a cached checkout's files are the run's commit.
// `excluded` names entries at the root only; they are left out of the member list rather than passed as --exclude,
// whose patterns GNU tar anchors at the root while bsdtar and BusyBox match them at any depth.
export function repoSnapshot(path: string, excluded: string[] = [".git"]): ReadableStream<Uint8Array> {
  const members = readdirSync(path).filter((name) => !excluded.includes(name));

  if (members.length === 0) {
    return Readable.toWeb(Readable.from([Buffer.alloc(EMPTY_TAR_BYTES)])) as ReadableStream<Uint8Array>;
  }

  const tar = spawn("tar", ["-c", "-C", path, "--", ...members], { stdio: ["ignore", "pipe", "pipe"] });

  tar.stderr.on("data", (chunk: Buffer) => console.error(`tar of ${path}: ${chunk.toString("utf8").trim()}`));

  return Readable.toWeb(tar.stdout) as ReadableStream<Uint8Array>;
}
