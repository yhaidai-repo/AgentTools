import { spawn } from "node:child_process";
import { Readable } from "node:stream";

// The cached checkout's files as a tar stream, without .git: the copy in the sandbox carries no remote, no history and
// no sign-in. The cache never refreshes a repo while a run holds it, so the files are the run's commit.
export function repoSnapshot(path: string): ReadableStream<Uint8Array> {
  const tar = spawn("tar", ["-c", "--exclude=./.git", "-C", path, "."], { stdio: ["ignore", "pipe", "pipe"] });

  tar.stderr.on("data", (chunk: Buffer) => console.error(`tar of ${path}: ${chunk.toString("utf8").trim()}`));

  return Readable.toWeb(tar.stdout) as ReadableStream<Uint8Array>;
}
