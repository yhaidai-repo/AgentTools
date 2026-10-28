import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { describe, it } from "node:test";
import { PACKAGES, WORKSPACE } from "@powerloom/sandbox";
import type { ExecOptions } from "../models/ExecOptions";
import type { ExecResult } from "../models/ExecResult";
import type { ContainerExec } from "./ContainerExec";
import { RepoImporter } from "./RepoImporter";

const GIT_IDENTITY = { GIT_AUTHOR_NAME: "sandbox", GIT_AUTHOR_EMAIL: "sandbox@local", GIT_COMMITTER_NAME: "sandbox", GIT_COMMITTER_EMAIL: "sandbox@local" };

// Runs the import script on this machine, with the container's root (/workspace, /packages) moved to a temp folder.
function localExec(root: string): ContainerExec {
  const run = (argv: string[], options: ExecOptions): Promise<ExecResult> => new Promise((resolve) => {
    const local = argv.map((arg) => arg.startsWith(`${WORKSPACE}/`) ? `${root}${arg}` : arg);
    const child = spawn(local[0], local.slice(1), { env: { ...process.env, ...GIT_IDENTITY }, stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stdout: Buffer.concat(stdout), stderr }));
    (options.stdin as Readable).pipe(child.stdin);
  });

  return { run } as unknown as ContainerExec;
}

function tarOf(folder: string): Readable {
  return spawn("tar", ["-c", "-C", folder, "."], { stdio: ["ignore", "pipe", "inherit"] }).stdout;
}

function folderWith(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), "repo-importer-src-")).replaceAll("\\", "/");

  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(folder, name), text);
  }

  return folder;
}

describe("RepoImporter", () => {
  it("replaces the repo's folder on a second copy, dropping deleted files and keeping /packages", async () => {
    const root = mkdtempSync(join(tmpdir(), "repo-importer-")).replaceAll("\\", "/");
    const repo = `${root}${WORKSPACE}/orders-api`;
    const importer = new RepoImporter(localExec(root));

    mkdirSync(`${root}${PACKAGES}`, { recursive: true });
    writeFileSync(`${root}${PACKAGES}/restored.txt`, "nuget");

    await importer.import("orders-api", tarOf(folderWith({ "a.cs": "one", "gone.cs": "old" })), "base");

    const second = await importer.import("orders-api", tarOf(folderWith({ "a.cs": "two", "b.cs": "new" })), "synced from your worktree");

    assert.deepEqual(second, { ok: true, value: { path: `${WORKSPACE}/orders-api`, files: 2 } });
    assert.equal(readFileSync(`${repo}/a.cs`, "utf8"), "two");
    assert.equal(existsSync(`${repo}/b.cs`), true);
    assert.equal(existsSync(`${repo}/gone.cs`), false);
    assert.equal(readFileSync(`${root}${PACKAGES}/restored.txt`, "utf8"), "nuget");

    rmSync(root, { recursive: true, force: true });
  });
});
