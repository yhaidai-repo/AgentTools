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
    ["Bash", { command: "npm test 2>/dev/null | tail -5" }],
    ["Bash", { command: "ls /d/cache/vault/.worktrees/app/feature-123/src" }],
    ["Bash", { command: "git log origin/main..HEAD" }],
    ["PowerShell", { command: "Get-ChildItem src > $null" }],
    ["Read", { file_path: "C:\\Users\\me\\notes.md" }],
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
    ["Bash", { command: "cp build/app.js /d/cache/vault/app/" }, "/d/cache/vault/app/"],
    ["Bash", { command: "cd .. && rm -rf feature-124" }, ".."],
    ["Bash", { command: "echo x > /tmp/out.txt" }, "/tmp/out.txt"],
    ["Bash", { command: "git -C D:\\cache\\vault\\app status" }, "D:\\cache\\vault\\app"],
    ["Bash", { command: "cat $HOME/.npmrc" }, "$HOME/.npmrc"],
    ["PowerShell", { command: "Set-Content -Path 'C:\\Windows\\x.txt' -Value 1" }, "C:\\Windows\\x.txt"],
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
    assert.equal((await decide(LINUX_FOLDER, "Bash", { command: "touch ../other/x" })).allow, false);
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

  for (const command of ["git commit -m \"push the button\"", "git status", "gh issue list", "az repos list", "npm run push-docs"]) {
    it(`allows ${command}`, async () => {
      assert.deepEqual(await decide(WINDOWS_FOLDER, "Bash", { command }), { allow: true });
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
