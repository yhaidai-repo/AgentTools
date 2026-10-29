import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSandboxBuildCommand } from "./buildRouting";
import { sandboxFolderOf, withSandboxPaths } from "./routedPaths";

const configured = ["dotnet build Shop.sln -c Release", "dotnet test Shop.sln --no-build", "make check"];

describe("isSandboxBuildCommand", () => {
  it("routes the usual .NET and npm builds and tests", () => {
    const routed = ["dotnet build", "dotnet test tests/Shop.Tests/Shop.Tests.csproj --filter Category=Unit", "dotnet restore", "npm test", "npm run build", "npm run test -- --watch=false"];

    for (const command of routed) {
      assert.equal(isSandboxBuildCommand(command, []), true, command);
    }
  });

  it("routes the vault's configured commands, also with more arguments", () => {
    assert.equal(isSandboxBuildCommand("make check", configured), true);
    assert.equal(isSandboxBuildCommand("make  check   V=1", configured), true);
    assert.equal(isSandboxBuildCommand("make check", []), false);
  });

  it("routes a build with a change of folder and output filters around it", () => {
    assert.equal(isSandboxBuildCommand("cd src/Shop.Api && dotnet build 2>&1 | tail -40", []), true);
    assert.equal(isSandboxBuildCommand("dotnet test 2>&1 | tail -50; echo \"EXIT: $?\"", []), true);
    assert.equal(isSandboxBuildCommand("dotnet test | grep| grep -E \"Failed|Passed\" | head -50", []), true);
  });

  it("keeps everything else with the worktree shell and its refusals", () => {
    const kept = ["git commit -m \"dotnet test passes\"", "dotnet run --project src/Shop.Api", "dotnet add package Polly", "npm install left-pad", "dotnet build && git push", "dotnet build; rm -rf obj", "dotnet test $(cat targets.txt)", "echo `dotnet test`", "ls tests", "cd src"];

    for (const command of kept) {
      assert.equal(isSandboxBuildCommand(command, configured), false, command);
    }
  });
});

describe("routed paths", () => {
  it("runs from the same folder of the copy, and in the repo's root from anywhere else", () => {
    assert.equal(sandboxFolderOf("D:\\cache\\.worktrees\\shop\\feature-1", "d:/cache/.worktrees/shop/feature-1/src/Api", "/workspace/shop"), "/workspace/shop/src/Api");
    assert.equal(sandboxFolderOf("/repos/.worktrees/shop/feature-1", "/repos/.worktrees/shop/feature-1", "/workspace/shop"), "/workspace/shop");
    assert.equal(sandboxFolderOf("/repos/.worktrees/shop/feature-1", "/tmp", "/workspace/shop"), "/workspace/shop");
  });

  it("points the worktree's absolute paths into the copy, in every spelling", () => {
    const worktree = "D:\\cache\\.worktrees\\shop\\feature-1";
    const command = "dotnet test D:\\cache\\.worktrees\\shop\\feature-1\\tests\\Shop.Tests.csproj && dotnet build d:/cache/.worktrees/shop/feature-1/Shop.sln && dotnet build /d/cache/.worktrees/shop/feature-1/x.sln";

    assert.equal(withSandboxPaths(command, worktree, "/workspace/shop"), "dotnet test /workspace/shop/tests/Shop.Tests.csproj && dotnet build /workspace/shop/Shop.sln && dotnet build /workspace/shop/x.sln");
    assert.equal(withSandboxPaths("dotnet test /repos/wt/T.csproj", "/repos/wt/", "/workspace/shop"), "dotnet test /workspace/shop/T.csproj");
  });
});
