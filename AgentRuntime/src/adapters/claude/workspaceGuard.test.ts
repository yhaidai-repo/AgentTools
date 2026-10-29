import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolPolicyDecision } from "../../models/ToolPolicyDecision";
import { isOutside, workspaceGuard } from "./workspaceGuard";

const WINDOWS_FOLDER = "D:\\cache\\vault\\.worktrees\\app\\feature-123";
const LINUX_FOLDER = "/repo-cache/vault/.worktrees/app/feature-123";

async function decide(folder: string, name: string, input: Record<string, unknown>): Promise<ToolPolicyDecision> {
  return workspaceGuard(folder)({ callId: "toolu_1", name, input, taskId: null, agentType: null });
}

describe("workspaceGuard on a Windows folder", () => {
  for (const [name, input] of [
    ["Edit", { file_path: "D:\\cache\\vault\\.worktrees\\app\\feature-123\\src\\a.ts" }],
    ["Edit", { file_path: "d:/CACHE/vault/.worktrees/app/feature-123/src/a.ts" }],
    ["Write", { file_path: "src\\new.ts" }],
    ["Write", { file_path: "src/../docs/notes.md" }],
    ["Write", { file_path: "..feature/x.md" }],
    ["NotebookEdit", { notebook_path: ".planning/spike.ipynb" }],
    ["Bash", { command: "git add -A && git commit -m \"Add totals\"" }],
    ["Bash", { command: "git log --oneline 2>/dev/null | head -5" }],
    ["Bash", { command: "ls /d/cache/vault/.worktrees/app/feature-123/src" }],
    ["Bash", { command: "git log origin/main..HEAD" }],
    ["PowerShell", { command: "dir src > $null" }],
    ["Read", { file_path: "C:\\Users\\me\\notes.md" }],
    ["Bash", { command: "git commit -qam \"fix(01-01): add totals. Mirrors Bug 17831 / PR 4230 on the old app\"" }],
    ["Bash", { command: "git commit -m \"Call the /api endpoint from ~ on\"" }],
    ["Bash", { command: "git log --format=\"%h // %s\" -5" }],
    ["Bash", { command: "git commit -m \"Totals in D:\\cache\\vault\\.worktrees\\app\\feature-123\\src stay\"" }],
    ["Bash", { command: "grep -rn \"a / b\" src" }],
  ] as const) {
    it(`allows ${name} ${JSON.stringify(input)}`, async () => {
      assert.deepEqual(await decide(WINDOWS_FOLDER, name, input), { allow: true });
    });
  }

  for (const [name, input, target] of [
    ["Edit", { file_path: "C:\\Users\\me\\.bashrc" }, "C:\\Users\\me\\.bashrc"],
    ["Write", { file_path: "D:/cache/vault/app/src/a.ts" }, "D:/cache/vault/app/src/a.ts"],
    ["Write", { file_path: "..\\feature-124\\a.ts" }, "..\\feature-124\\a.ts"],
    ["Write", { file_path: "src/../../feature-124/a.ts" }, "src/../../feature-124/a.ts"],
    ["Write", { file_path: "\\\\server\\share\\a.ts" }, "\\\\server\\share\\a.ts"],
    ["Write", { file_path: "~/notes.md" }, "~/notes.md"],
    ["Bash", { command: "ls /d/cache/vault/app/" }, "/d/cache/vault/app/"],
    ["Bash", { command: "git add ../feature-124" }, "../feature-124"],
    ["Bash", { command: "cat /tmp/out.txt" }, "/tmp/out.txt"],
    ["Bash", { command: "git -C D:\\cache\\vault\\app status" }, "D:\\cache\\vault\\app"],
    ["Bash", { command: "cat $HOME/.npmrc" }, "$HOME/.npmrc"],
    ["PowerShell", { command: "type 'C:\\Windows\\x.txt'" }, "C:\\Windows\\x.txt"],
    ["Bash", { command: "cat \"/etc/passwd\"" }, "/etc/passwd"],
    ["Bash", { command: "cat \"/c/Program Files/x.txt\"" }, "/c/Program"],
    ["Bash", { command: "cat '/etc/my notes.txt'" }, "/etc/my"],
    ["Bash", { command: "grep -rn total \"~/notes\"" }, "~/notes"],
    ["Bash", { command: "git commit -m \"Copy from ../feature-124/a.ts\"" }, "../feature-124/a.ts"],
    ["Bash", { command: "git commit -m \"Read $HOME/.npmrc first\"" }, "$HOME/.npmrc"],
  ] as const) {
    it(`denies ${name} ${JSON.stringify(input)}`, async () => {
      const decision = await decide(WINDOWS_FOLDER, name, input);

      assert.deepEqual(decision, { allow: false, reason: `${name} was blocked: ${target} is outside the run's folder.` });
    });
  }
});

describe("workspaceGuard on a Linux folder", () => {
  it("allows a write inside and denies one outside", async () => {
    assert.deepEqual(await decide(LINUX_FOLDER, "Write", { file_path: `${LINUX_FOLDER}/src/a.ts` }), { allow: true });
    assert.equal((await decide(LINUX_FOLDER, "Write", { file_path: "/etc/hosts" })).allow, false);
    assert.equal((await decide(LINUX_FOLDER, "Bash", { command: "cat ../other/x" })).allow, false);
  });
});

describe("workspaceGuard publishing", () => {
  for (const [command, label] of [
    ["git push", "git push"],
    ["git push origin HEAD:refs/heads/feature/123", "git push"],
    ["git -C . -c http.extraHeader=x push --force", "git push"],
    ["npm test && git push -u origin feature/123", "git push"],
    ["git.exe push", "git push"],
    ["gh pr create --fill", "gh pr"],
    ["gh pr merge 12", "gh pr"],
    ["az repos pr create --title x", "az repos pr"],
  ] as const) {
    it(`denies ${command}`, async () => {
      const decision = await decide(WINDOWS_FOLDER, "Bash", { command });

      assert.deepEqual(decision, { allow: false, reason: `Bash was blocked: ${label} is not allowed; commit locally and leave publishing to a person.` });
    });
  }

  for (const command of ["git commit -m \"push the button\"", "git status"]) {
    it(`allows ${command}`, async () => {
      assert.deepEqual(await decide(WINDOWS_FOLDER, "Bash", { command }), { allow: true });
    });
  }

  it("keeps the push reason for git push inside a pipeline", async () => {
    const decision = await decide(WINDOWS_FOLDER, "Bash", { command: "git commit -m x && git push" });

    assert.match(decision.allow ? "" : decision.reason, /git push is not allowed/);
  });
});

describe("workspaceGuard shell", () => {
  const sandboxReason = "is not allowed in the worktree's shell. The worktree's shell runs only git (without push, fetch, pull, clone, remote), GSD's node tool and listing commands (ls, dir, cat, type, find, rg, grep, head, tail, wc, pwd). A plain build or test command (dotnet build, dotnet test, npm test, npm run build, or the repo's configured command), alone or after one `cd <folder> &&` and with output filters at most, runs in the sandbox. Everything else is refused: edit files with Edit or Write, and run other scripts with run_command if you have it.";

  for (const command of [
    "git commit -m \"Add totals; fix rounding | tests\"",
    "git -C . -c core.autocrlf=false commit -m x",
    "git commit -m \"$(cat <<'EOF'\nAdd totals\n\nSecond line\nEOF\n)\"",
    "git add -A && git commit -m x && git log -1",
    "node D:\\cache\\vault\\.worktrees\\app\\feature-123\\.claude\\gsd-core\\bin\\gsd-tools.cjs init plan-phase 1",
    "node \".claude/gsd-core/bin/gsd-tools.cjs\" state load",
    "npx gsd-core --version",
    "rg -n total src | head -20",
    "find src -name \"*.ts\" | wc -l",
    "pwd",
  ]) {
    it(`allows ${JSON.stringify(command)}`, async () => {
      assert.deepEqual(await decide(WINDOWS_FOLDER, "Bash", { command }), { allow: true });
    });
  }

  for (const [command, word] of [
    ["dotnet test", "dotnet"],
    ["git status && dotnet build", "dotnet"],
    ["git log | xargs rm", "xargs"],
    ["npm test", "npm"],
    ["git fetch origin", "git"],
    ["git pull", "git"],
    ["git clone https://dev.azure.com/org/app", "git"],
    ["git remote add other https://x", "git"],
    ["cat a.txt > b.txt", "cat"],
    ["find . -name x -delete", "find"],
    ["git status \"$(dotnet test)\"", "git"],
    ["cd src", "cd"],
    ["node scripts/build.js", "node"],
  ] as const) {
    it(`denies ${JSON.stringify(command)} and points to the sandbox`, async () => {
      const decision = await decide(WINDOWS_FOLDER, "Bash", { command });

      assert.deepEqual(decision, { allow: false, reason: `Bash was blocked: ${word} ${sandboxReason}` });
    });
  }
});

describe("isOutside", () => {
  it("treats the folder itself as inside", () => {
    assert.equal(isOutside(WINDOWS_FOLDER, WINDOWS_FOLDER), false);
    assert.equal(isOutside(WINDOWS_FOLDER, "."), false);
  });

  it("compares Windows paths without regard to case or slash", () => {
    assert.equal(isOutside(WINDOWS_FOLDER, "D:/Cache/Vault/.Worktrees/App/Feature-123/a"), false);
  });

  it("puts a path on another drive outside", () => {
    assert.equal(isOutside(WINDOWS_FOLDER, "E:\\cache\\vault\\.worktrees\\app\\feature-123"), true);
  });
});
