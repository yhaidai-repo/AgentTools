import type { Readable } from "node:stream";
import { WORKSPACE, type RepoUploaded } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { ContainerExec } from "./ContainerExec";

const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IMPORT_DEADLINE_MS = 10 * 60_000;

// The tar holds the repo's files without .git: the copy becomes a git repo of its own with one commit, so the agent
// has status and diff of its own changes, and no remote, history or sign-in of the original.
const IMPORT_SCRIPT = [
  "set -e",
  `rm -rf -- "$1" && mkdir -p -- "$1" && tar -x -C "$1"`,
  `cd -- "$1" && git init -q && git add -A && git commit -q --no-verify -m "$2"`,
  "git ls-files | wc -l",
].join("\n");

export class RepoImporter {
  constructor(private readonly exec: ContainerExec) {}

  async import(name: string, tar: Readable, message: string): Promise<Outcome<RepoUploaded>> {
    if (!REPO_NAME.test(name)) {
      return { ok: false, reason: `"${name}" is not a repo folder name` };
    }

    const path = `${WORKSPACE}/${name}`;
    const result = await this.exec.run(["sh", "-c", IMPORT_SCRIPT, "sh", path, message], { stdin: tar, deadlineMs: IMPORT_DEADLINE_MS });

    if (result.exitCode !== 0) {
      throw new Error(`Copying ${name} into the sandbox failed: ${result.stderr.trim() || `exit code ${result.exitCode}`}`);
    }

    return { ok: true, value: { path, files: Number.parseInt(result.stdout.toString("utf8"), 10) || 0 } };
  }
}
