import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { GSD_CORE_VERSION, GsdWorktreePreparer } from "./GsdWorktreePreparer";

const identity = { name: "PowerLoom Coder", email: "coder@powerloom.test" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

// A fake gsd-core whose installer records each run and writes the file the real one writes.
async function createGsdCore(root: string, version = GSD_CORE_VERSION): Promise<string> {
  const core = join(root, "gsd-core");

  await mkdir(join(core, "bin"), { recursive: true });
  await writeFile(join(core, "package.json"), JSON.stringify({ name: "@opengsd/gsd-core", version }));
  await writeFile(join(core, "bin", "install.js"), [
    "const fs = require('node:fs');",
    "fs.mkdirSync('.claude', { recursive: true });",
    "fs.writeFileSync('.claude/settings.local.json', '{}');",
    "fs.writeFileSync('.claude/install-args.log', process.argv.slice(2).join(' '));",
  ].join("\n"));

  return core;
}

async function createLinkedWorktree(root: string): Promise<{ main: string; worktree: string }> {
  const main = join(root, "main");
  const worktree = join(root, "pbi");

  await mkdir(main);
  git(main, "init", "-b", "main");
  git(main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--allow-empty", "-m", "init");
  git(main, "worktree", "add", "-b", "pbi", worktree);

  return { main, worktree };
}

async function withRepo(test: (paths: { main: string; worktree: string; core: string }) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "gsd-prep-"));

  try {
    await test({ ...(await createLinkedWorktree(root)), core: await createGsdCore(root) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

it("creates .planning, merges config.json, ignores both folders and installs GSD", async () => {
  await withRepo(async ({ main, worktree, core }) => {
    await mkdir(join(worktree, ".planning"));
    await writeFile(join(worktree, ".planning", "config.json"), JSON.stringify({ mode: "yolo", commit_docs: true }));

    await new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity });

    const config = JSON.parse(await readFile(join(worktree, ".planning", "config.json"), "utf8"));
    assert.deepEqual(config, { mode: "yolo", commit_docs: false });
    assert.equal(await readFile(join(worktree, ".planning", ".gitignore"), "utf8"), "*\n");
    assert.equal(await readFile(join(worktree, ".claude", ".gitignore"), "utf8"), "*\n");
    assert.doesNotMatch(await readFile(join(main, ".git", "info", "exclude"), "utf8"), /\.planning|\.claude/);
    assert.equal(await readFile(join(worktree, ".claude", "install-args.log"), "utf8"), "--local --claude --relative-includes --no-legacy-cleanup");
    assert.equal(git(worktree, "status", "--porcelain").trim(), "");
  });
});

it("creates .planning and config.json when the worktree has neither", async () => {
  await withRepo(async ({ worktree, core }) => {
    await new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity });

    assert.deepEqual(JSON.parse(await readFile(join(worktree, ".planning", "config.json"), "utf8")), { commit_docs: false });
    assert.equal(await exists(join(worktree, ".planning")), true);
  });
});

it("merges the run's seed into config.json one level deep and writes its files into .planning", async () => {
  await withRepo(async ({ worktree, core }) => {
    await mkdir(join(worktree, ".planning"));
    await writeFile(join(worktree, ".planning", "config.json"), JSON.stringify({ mode: "yolo", workflow: { research: false, verifier: true } }));
    const seed = {
      config: { model_profile: "adaptive", model_overrides: { "gsd-planner": "claude-opus-5-5" }, workflow: { research: true }, commit_docs: true },
      files: [{ path: "PBI.md", content: "# PBI-1\n" }, { path: "context/answers.md", content: "none\n" }],
    };

    await new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity, seed });

    const config = JSON.parse(await readFile(join(worktree, ".planning", "config.json"), "utf8"));
    assert.deepEqual(config, { mode: "yolo", workflow: { research: true, verifier: true }, model_profile: "adaptive", model_overrides: { "gsd-planner": "claude-opus-5-5" }, commit_docs: false });
    assert.equal(await readFile(join(worktree, ".planning", "PBI.md"), "utf8"), "# PBI-1\n");
    assert.equal(await readFile(join(worktree, ".planning", "context", "answers.md"), "utf8"), "none\n");
    assert.equal(git(worktree, "status", "--porcelain").trim(), "");
  });
});

it("refuses a seed file outside .planning before writing any", async () => {
  await withRepo(async ({ worktree, core }) => {
    const seed = { config: {}, files: [{ path: "PBI.md", content: "x" }, { path: "../escape.md", content: "x" }] };

    await assert.rejects(new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity, seed }), /not inside \.planning/);
    assert.equal(await exists(join(worktree, ".planning", "PBI.md")), false);
    assert.equal(await exists(join(worktree, "escape.md")), false);
  });
});

it("returns the commit identity as environment and leaves every git config alone", async () => {
  await withRepo(async ({ main, worktree, core }) => {
    const before = await readFile(join(main, ".git", "config"), "utf8");
    const env = await new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity });

    assert.deepEqual(env, { GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email });
    assert.equal(await readFile(join(main, ".git", "config"), "utf8"), before);
  });
});

it("a second run changes no file", async () => {
  await withRepo(async ({ worktree, core }) => {
    const preparer = new GsdWorktreePreparer();
    const files = [join(worktree, ".planning", "config.json"), join(worktree, ".planning", ".gitignore"), join(worktree, ".claude", ".gitignore")];

    await preparer.prepare({ worktree, gsdCore: core, identity });
    const before = await Promise.all(files.map((file) => readFile(file, "utf8")));
    await preparer.prepare({ worktree, gsdCore: core, identity });
    const after = await Promise.all(files.map((file) => readFile(file, "utf8")));

    assert.deepEqual(after, before);
  });
});

it("refuses a gsd-core that is not the pinned version", async () => {
  await withRepo(async ({ worktree }) => {
    const other = await createGsdCore(join(worktree, ".."), "1.20.0");

    await assert.rejects(new GsdWorktreePreparer().prepare({ worktree, gsdCore: other, identity }), /1\.19\.0 is required, found 1\.20\.0/);
    assert.equal(await exists(join(worktree, ".planning")), false);
  });
});

it("refuses an empty commit identity before it changes git config", async () => {
  await withRepo(async ({ worktree, core }) => {
    await assert.rejects(new GsdWorktreePreparer().prepare({ worktree, gsdCore: core, identity: { name: "", email: "x@y.z" } }), /name and an email/);
  });
});
